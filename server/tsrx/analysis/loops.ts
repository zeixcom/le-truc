/**
 * Loop planning (LT-022, regrouping move M5): Pass 1 — server-data `@for`
 * → `each()` plans (output selector, collection naming, hoisted-const
 * rebinding, loop-scoped effects); Pass 1b — reactive-list `@for` over a
 * declared `createList` → `reconcile()` plans (container/template
 * addressing, item hole, bindItem-scoped events).
 */

import type { TsrxNode } from '@tsrx/core'
import {
	CONTEXT_NAMES,
	JS_GLOBALS,
	nodeType,
	objectKeys,
	sanitizeVarName,
} from '../ast-utils'
import { diagnostic } from '../diagnostics'
import { dependenciesOf } from '../evaluability'
import type { AttributeIR, ForIR, TemplateNode } from '../ir'
import { returnsNumber } from './harvest'
import type {
	AnalysisContext,
	LoopEffectPlan,
	RebindingPlan,
	ReconcileItemEvents,
} from './plan'
import {
	countForSelector,
	type ElementNode,
	isElement,
	resolveSelector as resolveSelectorIn,
	resolveSelectorIn as resolveSelectorScoped,
	staticAttrs,
} from './selectors'

/* === Exported Functions === */

/** Passes 1+1b: every `@for` in the template gets its client plan. */
export const runLoops = (ctx: AnalysisContext): void => {
	const {
		component,
		source,
		diagnostics,
		addQuery,
		usedNames,
		refNames,
		collectAmbient,
		forPlans,
		reconcilePlans,
	} = ctx
	const resolveSelector = (el: ElementNode) => resolveSelectorIn(component, el)

	// --- Pass 1: @for loops → each() plans ---------------------------------

	for (const loop of component.fors.values()) {
		if (loop.listSignal) continue // reactive loops → pass 1b (reconcile)
		const output = loop.output
		const { selector, unique } = resolveSelector(output)
		if (!unique) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					output.node.start,
					`No unique selector for the @for output <${output.tag}> in the rendered template; add a distinguishing static attribute (role, class, or data-*).`,
				),
			)
		}
		// Collection naming: the iterable's name when still free, else the
		// plural of the output's role (last segment), else tag + 's'.
		const roleValue = staticAttrs(output).get('role')
		const fallbackBase =
			roleValue !== undefined && roleValue !== null
				? `${roleValue.split('-').pop() ?? roleValue}s`
				: `${output.tag}s`
		const base =
			loop.iterableName && !usedNames.has(loop.iterableName)
				? loop.iterableName
				: fallbackBase
		const collection = addQuery(base, selector, 'many')

		const loopBound = new Set<string>([loop.itemName])
		if (loop.indexName) loopBound.add(loop.indexName)
		// Map hoisted const → attribute it was rendered into as a bare value.
		const constAttr = new Map<string, string>()
		for (const attr of output.attrs) {
			if (attr.kind === 'server' && nodeType(attr.node) === 'Identifier')
				constAttr.set(attr.exprText, attr.name)
		}

		const referencedConsts = new Set<string>()
		/**
		 * Validate free names of a client construct inside the loop: signals
		 * and (rebuilt) hoisted consts are fine; loop variables are the
		 * hoist-first error; anything else is server-only.
		 */
		const checkClientNames = (node: TsrxNode, what: string): void => {
			collectAmbient(node)
			const free = dependenciesOf(node)
			const loopRefs = [...free].filter(name => loopBound.has(name))
			if (loopRefs.length > 0) {
				diagnostics.push(
					diagnostic.loopVariableInReactiveThunk(source, node.start, loopRefs),
				)
				return
			}
			const bad: string[] = []
			for (const name of free) {
				if (component.signals.some(s => s.name === name)) continue
				if (loop.hoisted.some(h => h.name === name)) {
					referencedConsts.add(name)
					continue
				}
				if (refNames.has(name)) continue
				if (JS_GLOBALS.has(name)) continue
				if (CONTEXT_NAMES.has(name)) continue
				bad.push(name)
			}
			if (bad.length > 0) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.start,
						`${what} references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')} inside an @for body; the client only knows signals, refs, and rebound consts`,
					),
				)
			}
		}

		const effectsPlan: LoopEffectPlan[] = []
		const collectAttrs = (el: ElementNode, target: string | null): void => {
			for (const attr of el.attrs) {
				if (attr.kind === 'reactive') {
					checkClientNames(attr.thunk, `Reactive attribute \`${attr.name}\``)
					effectsPlan.push({
						kind: 'watch-attr',
						attr: attr.name,
						thunkText: attr.thunkText,
						coerceToString: returnsNumber(attr.thunk.body),
						sourceStart: attr.thunk.start,
						sourceEnd: attr.thunk.end,
						target,
					})
				} else if (attr.kind === 'class-map') {
					checkClientNames(attr.object, 'Reactive class map')
					effectsPlan.push({
						kind: 'watch-class',
						keys: objectKeys(attr.object, { allowStrings: false }),
						thunkText: attr.thunkText,
						sourceStart: attr.thunk.start,
						sourceEnd: attr.thunk.end,
						target,
					})
				} else if (attr.kind === 'event') {
					checkClientNames(attr.handler, `Event attribute \`${attr.name}\``)
					effectsPlan.push({
						kind: 'on',
						event: attr.event,
						handlerText: attr.handlerText,
						sourceStart: attr.handler.start,
						sourceEnd: attr.handler.end,
						target,
					})
				}
			}
		}
		collectAttrs(output, null)
		// LT-037: descendants of the loop's output root (nested inside its
		// own subtree — a native <input> inside a wrapping <label>, etc.)
		// get their reactive attrs/events addressed too, via a selector
		// resolved WITHIN the output's own subtree (never the whole
		// template — the same element shape repeats once per item, so a
		// selector unique against the global template would be meaningless;
		// `resolveSelectorIn(output, descendant)` scopes the uniqueness
		// count to just this one item's rendered markup instead).
		const collectDescendants = (el: ElementNode): void => {
			for (const child of el.children) {
				if (child.kind !== 'element') continue
				const hasConstruct = child.attrs.some(
					a =>
						a.kind === 'reactive' ||
						a.kind === 'class-map' ||
						a.kind === 'event',
				)
				if (hasConstruct) {
					const resolved = resolveSelectorScoped(output, child)
					if (!resolved.unique) {
						diagnostics.push(
							diagnostic.unaddressableElement(
								source,
								child.node.start,
								`No unique selector for <${child.tag}> inside the @for output <${output.tag}>; add a distinguishing static attribute (role, class, or data-*).`,
							),
						)
					}
					collectAttrs(child, resolved.selector)
				}
				collectDescendants(child)
			}
		}
		collectDescendants(output)
		const gatedLazyChild = (node: TemplateNode): unknown => {
			if (node.kind === 'expr' && node.lazy) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						node.node.start,
						'Lazy &{ } children inside server-data @for bodies have no lowering (each() scopes own no template slots)',
					),
				)
			}
			if (node.kind === 'element')
				for (const child of node.children) gatedLazyChild(child)
			return undefined
		}
		gatedLazyChild(loop.output)

		const itemParam =
			loop.itemName === collection ? `${loop.itemName}El` : loop.itemName
		const rebindings: RebindingPlan[] = []
		for (const hoisted of loop.hoisted) {
			if (!referencedConsts.has(hoisted.name)) continue
			const attr = constAttr.get(hoisted.name)
			if (!attr) {
				diagnostics.push(
					diagnostic.constNotRebindable(
						source,
						hoisted.node.start,
						hoisted.name,
						output.tag,
					),
				)
				continue
			}
			rebindings.push({
				name: hoisted.name,
				expr:
					attr === 'id'
						? `${itemParam}.id`
						: `${itemParam}.getAttribute('${attr}')!`,
			})
		}

		forPlans.set(loop, {
			collection,
			itemParam,
			rebindings,
			effects: effectsPlan,
		})
	}

	// --- Pass 1b: reactive-list @for → reconcile() plans (milestone 3) -------

	const parentOf = (target: TemplateNode): ElementNode | null => {
		const walk = (node: TemplateNode): ElementNode | null => {
			if (!isElement(node)) return null
			for (const child of node.children) {
				if (child === target) return node
				const found = walk(child)
				if (found) return found
			}
			return null
		}
		return walk(component.root)
	}

	for (const loop of component.fors.values()) {
		if (!loop.listSignal) continue
		// One reactive list per component: every extracted template would
		// match the same `first('template')` query, and the second list's
		// reconcile would clone the FIRST list's item shape with no
		// diagnostic. Scoped template addressing (sibling selectors) is the
		// follow-up if a corpus component ever needs two lists.
		if (reconcilePlans.size > 0) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					loop.output.node.start,
					'Only one reactive-list @for per component is supported — a second list would share the extracted <template> selector. Split into components or use server-data lists.',
				),
			)
			continue
		}
		const output = loop.output

		// Container: the parent element holding the loop output. The host
		// itself cannot be the container (no self-query).
		const container = parentOf(output)
		if (!container || container === component.root) {
			diagnostics.push(
				diagnostic.unsupported(
					source,
					output.node.start,
					'A reactive-list @for directly under the component root — reconcile() needs a container element distinct from the host (wrap the loop in one).',
				),
			)
			continue
		}
		const containerSelector = resolveSelector(container)
		if (!containerSelector.unique) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					container.node.start,
					`No unique selector for the @for container <${container.tag}>; add a distinguishing static attribute (role, class, or data-*).`,
				),
			)
		}
		const containerName = addQuery(
			'container',
			containerSelector.selector,
			'one',
		)

		// The extracted <template> is compiler-emitted; an authored one would
		// collide with the emitted selector.
		if (countForSelector(component.root, 'template') > 0) {
			diagnostics.push(
				diagnostic.unaddressableElement(
					source,
					output.node.start,
					'An authored <template> collides with the compiler-extracted item template of the reactive-list @for.',
				),
			)
		}
		const templateName = addQuery('template', 'template', 'one')

		// The item hole's parent element — the item value's DOM site, used by
		// the arg-seeded harvest read.
		const findHoleParent = (node: TemplateNode): ElementNode | null => {
			if (!isElement(node)) return null
			for (const child of node.children) {
				if (
					child.kind === 'expr' &&
					child.lazy &&
					child.exprText === loop.itemName
				)
					return node
				const found = findHoleParent(child)
				if (found) return found
			}
			return null
		}
		const holeParent = findHoleParent(output)
		const holeSelector = holeParent
			? resolveSelectorScoped(output, holeParent).selector
			: output.tag

		// Per-item events, grouped per target element, bindItem-scoped.
		const itemEvents: ReconcileItemEvents[] = []
		const takenNames = new Set<string>([
			loop.itemName,
			...(loop.keyName ? [loop.keyName] : []),
			'first',
			'_element',
		])
		const checkItemHandler = (handler: TsrxNode, what: string): void => {
			collectAmbient(handler)
			const free = dependenciesOf(handler)
			if (free.has(loop.itemName)) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						handler.start,
						`${what} references the loop item \`${loop.itemName}\` — inside reconcile()'s bindItem it is a Signal, not the value; render it via &{${loop.itemName}} instead.`,
					),
				)
			}
			const bad = [...free].filter(
				name =>
					name !== loop.itemName &&
					name !== loop.keyName &&
					!component.signals.some(s => s.name === name) &&
					!refNames.has(name) &&
					!JS_GLOBALS.has(name) &&
					!CONTEXT_NAMES.has(name),
			)
			if (bad.length > 0) {
				diagnostics.push(
					diagnostic.unsupported(
						source,
						handler.start,
						`${what} references server-only name(s) ${bad.map(b => `\`${b}\``).join(', ')} inside a reactive-list @for body; the client only knows signals, refs, the key binding, and globals`,
					),
				)
			}
		}
		const collectItemEvents = (
			node: TemplateNode,
			isItemRoot: boolean,
		): void => {
			if (!isElement(node)) return
			const elementEvents = node.attrs.filter(a => a.kind === 'event') as Array<
				Extract<AttributeIR, { kind: 'event' }>
			>
			if (elementEvents.length > 0) {
				let target: ReconcileItemEvents | undefined
				if (isItemRoot) {
					target = itemEvents.find(e => e.selector === null)
					if (!target) {
						target = {
							selector: null,
							name: '_element',
							message: '',
							events: [],
						}
						itemEvents.push(target)
					}
				} else {
					const scoped = resolveSelectorScoped(output, node)
					if (!scoped.unique) {
						diagnostics.push(
							diagnostic.unaddressableElement(
								source,
								node.node.start,
								`No unique selector for <${node.tag}> inside the @for item template; add a distinguishing static attribute.`,
							),
						)
					}
					target = itemEvents.find(e => e.selector === scoped.selector)
					if (!target) {
						let name = sanitizeVarName(node.tag)
						while (takenNames.has(name)) name = `${name}El`
						takenNames.add(name)
						target = {
							selector: scoped.selector,
							name,
							message: `${component.tag}: ${scoped.selector} missing`,
							events: [],
						}
						itemEvents.push(target)
					}
				}
				for (const attr of elementEvents) {
					checkItemHandler(attr.handler, `Event attribute \`${attr.name}\``)
					target.events.push({
						event: attr.event,
						handlerText: attr.handlerText,
						sourceStart: attr.handler.start,
						sourceEnd: attr.handler.end,
					})
				}
			}
			for (const child of node.children) collectItemEvents(child, false)
		}
		collectItemEvents(output, true)

		reconcilePlans.set(loop, {
			tag: component.tag,
			container: containerName,
			template: templateName,
			signal: loop.listSignal,
			itemParam: loop.itemName,
			keyParam: loop.keyName,
			holeSelector,
			itemEvents,
		})
	}
}
