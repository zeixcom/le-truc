/**
 * Handler args (LT-461): an arg named `on` plus a capital letter, which the
 * child places as an event attribute on an element it owns
 * (`<button onClick={onClick}>`) and the parent binds at its compose site
 * (`<BasicButton class="remove" onClick={e => items.remove(k)} />`).
 *
 * Two halves, one record. The child's half publishes where each arg lands
 * (`handlerPlacementsOf` → `InternalRegistryEntry.handlerArgs`): a selector proven
 * unique under its host, or the composed child it forwards the arg to. The
 * parent's half resolves a compose site's handler through that record,
 * recursively across forwards (`resolveHandlerPlacements`), and joins the
 * site's selector with each placement's (`joinSelector`) — the selector the
 * parent's `on()` queries. The compiler synthesizes it from the child's
 * signature, so it is no reach-in (HOST_PROFILE § data account, bullet 3).
 */

import { diagnostic, type LocalDiagnostic } from '../diagnostics'
import type { ComponentIR, ComposedMarkup, TemplateNode } from '../ir'
import type { HandlerPlacement, InternalRegistryEntry } from '../registry'
import { childNodes } from '../walk'
import {
	allComposeNodes,
	composedChildMayMatch,
	composeNodesBySource,
	composeSiteAddress,
	composeSiteRefusal,
	resolveScopedSelector,
} from './selectors'

/** A placement resolved to the element the parent's `on()` binds. */
export type ResolvedPlacement = {
	event: string
	selector: string
	optional: boolean
}

/**
 * Every handler-arg placement of `component`, by arg name, for its registry
 * entry. A placement's selector is proved against the component's own
 * template with every composed child's markup taken as unknown: the entry
 * the parent reads is the registry-discovery pass's, which has no composed
 * shapes, so the proof must hold whatever a composed child renders. Where
 * no candidate survives that, the `:scope >` child path does — a composed
 * child's markup is never a direct child of an element of this template.
 *
 * A placement in a server-rendered branch is `optional`. Placements in a
 * reactive arm, a reactive-list item or a server-data loop body are LTC081
 * (the front end's `reportHandlerArgPlacements`) and are skipped here, as
 * is composed content, where a handler arg is LTC011. A placement with no
 * unique selector is LTC007.
 */
export const handlerPlacementsOf = (
	component: ComponentIR,
	diagnostics: LocalDiagnostic[],
): Record<string, HandlerPlacement[]> | undefined => {
	const placements: Record<string, HandlerPlacement[]> = {}
	const add = (arg: string, placement: HandlerPlacement): void => {
		placements[arg] ??= []
		placements[arg].push(placement)
	}
	const unknownMarkup = new Map<string, ComposedMarkup>(
		allComposeNodes(component.root).map(node => [
			node.source,
			{
				tag: null,
				shapes: [{ kind: 'any' }],
				region: null,
				owner: component.tag,
			},
		]),
	)
	const loopOutputs = new Set<TemplateNode>(
		[...component.fors.values()].map(loop => loop.output),
	)
	const visit = (node: TemplateNode, optional: boolean): void => {
		if (node.kind === 'element') {
			if (node !== component.root && loopOutputs.has(node)) return
			for (const attr of node.attrs) {
				if (attr.kind !== 'handler-arg') continue
				const { selector, unique } = resolveScopedSelector(
					component.root,
					node,
					unknownMarkup,
				)
				if (!unique) {
					diagnostics.push(
						diagnostic.unaddressableElement(
							component.source,
							node.node,
							`No unique selector for <${node.tag}>, which carries the handler arg \`${attr.arg}\` — add a distinguishing static attribute (\`role\`, \`class\` or \`data-*\`).`,
						),
					)
					continue
				}
				add(attr.arg, { event: attr.event, selector, optional })
			}
			for (const child of node.children) visit(child, optional)
			return
		}
		if (node.kind === 'compose') {
			const forwards = node.attrs.flatMap(attr =>
				attr.kind === 'handler' && attr.forward !== null
					? [{ arg: attr.name, forward: attr.forward }]
					: [],
			)
			if (forwards.length === 0) return
			// The clause is chosen without the child's tag (LT-498): the entry a
			// parent reads is the registry-discovery pass's, which knows none,
			// so any raw custom element counts against it — the same choice in
			// both passes. Once the tag is known, a clause that another composed
			// child's markup could match is refused: the record has no room
			// for an exclusion the discovery pass could not have written.
			const address = composeSiteAddress(component.root, node, null)
			const childTag = component.composedShapes?.get(node.source)?.tag ?? null
			const need = 'the handler arg it forwards needs a unique target'
			if (address.kind !== 'unique') {
				diagnostics.push(
					diagnostic.unaddressableElement(
						component.source,
						node.node,
						composeSiteRefusal(
							node,
							null,
							composeNodesBySource(component.root, node.source),
							need,
						),
					),
				)
				return
			}
			if (
				childTag !== null &&
				component.composedShapes &&
				composedChildMayMatch(
					component.root,
					node,
					childTag,
					address.clause,
					component.composedShapes,
				)
			) {
				diagnostics.push(
					diagnostic.unaddressableElement(
						component.source,
						node.node,
						composeSiteRefusal(node, childTag, [node], need),
					),
				)
				return
			}
			for (const { arg, forward } of forwards)
				add(forward, {
					via: node.source,
					clause: address.clause,
					arg,
					optional,
				})
			return
		}
		if (node.kind === 'conditional') {
			if (node.mode === 'reactive') return
			for (const child of childNodes(node)) visit(child, true)
			return
		}
		if (node.kind === 'try') {
			if (node.pendingChildren !== null) return
			for (const child of childNodes(node)) visit(child, true)
		}
	}
	visit(component.root, false)
	return Object.keys(placements).length > 0 ? placements : undefined
}

/**
 * Join a compose site's selector with a placement selector relative to the
 * child's host: a `:scope >` child path continues from the site, anything
 * else descends from it. An empty prefix is the child's host itself — an
 * arm root's own mount, whose `first` is bound to it.
 */
export const joinSelector = (prefix: string, relative: string): string => {
	if (prefix === '') return relative
	return relative.startsWith(':scope')
		? `${prefix}${relative.slice(':scope'.length)}`
		: `${prefix} ${relative}`
}

/**
 * The elements a compose site's handler `arg` binds on, resolved through
 * `entry` — the composed child's — and, across a forward, through each inner
 * child's entry in turn, the selector descending through both boundaries.
 * A forward to a source with no entry resolves to nothing (the registry-
 * discovery tolerance); a forwarding cycle stops at the repeat.
 */
export const resolveHandlerPlacements = (
	entry: InternalRegistryEntry,
	arg: string,
	registry: ReadonlyMap<string, InternalRegistryEntry>,
	seen: ReadonlySet<string> = new Set([entry.source]),
): ResolvedPlacement[] => {
	const resolved: ResolvedPlacement[] = []
	for (const placement of entry.handlerArgs?.[arg] ?? []) {
		if ('event' in placement) {
			resolved.push(placement)
			continue
		}
		const inner = registry.get(placement.via)
		if (!inner || seen.has(placement.via)) continue
		for (const nested of resolveHandlerPlacements(
			inner,
			placement.arg,
			registry,
			new Set([...seen, placement.via]),
		))
			resolved.push({
				event: nested.event,
				selector: joinSelector(
					`${inner.tag}${placement.clause}`,
					nested.selector,
				),
				optional: placement.optional || nested.optional,
			})
	}
	return resolved
}
