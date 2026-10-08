/**
 * The content model (ADR 0048 s4, LT-477): a child may declare its passed
 * `children` non-interactive — `Children<Roles, 'non-interactive'>` — and a
 * compose site of that child refuses interactive content: a literal element
 * among the site's literal children, or a composed child whose own template
 * renders one, transitively through the compose registry (the same closure
 * `composedShapesFor` runs over `renderedShapes`' `compose` references).
 *
 * Interactive means: `a[href]`, `button`, `input` (except `type="hidden"`),
 * `select`, `textarea`, `label`, `details`, `iframe`, any `[tabindex]`, and
 * `audio`/`video` with `controls`. A dynamic attribute of a deciding name
 * (`href`, `tabindex`, `controls`, `type`) may hold any value, so it counts
 * as present — the check refuses, and a false refusal names the element the
 * author can move; a missed one ships an accessibility bug. TypeScript
 * cannot carry the check (JSX element types are opaque), and page-authored
 * HTML stays unchecked: the compiler sees only compiled compose sites.
 */

import type { TemplateNode } from '../ir'
import type { RegistryEntry } from '../registry'
import { childNodes, someNode } from '../walk'

/* === Types === */

type ElementNode = Extract<TemplateNode, { kind: 'element' }>

/** What the compose-site check found, named for the message. */
export type InteractiveFinding =
	| { kind: 'element'; describe: string }
	| { kind: 'component'; tag: string }

/* === Internal Functions === */

/** Whether an attribute of `name` is present on `element` in any kind that renders one. */
const hasAttr = (element: ElementNode, name: string): boolean =>
	element.attrs.some(
		attr =>
			(attr.kind === 'static' ||
				attr.kind === 'server' ||
				attr.kind === 'reactive') &&
			attr.name === name,
	)

/** The static value of `name`, when the element carries it as a literal. */
const staticAttr = (
	element: ElementNode,
	name: string,
): string | null | undefined => {
	for (const attr of element.attrs)
		if (attr.kind === 'static' && attr.name === name) return attr.value
	return undefined
}

/* === Exported Functions === */

/**
 * How `element` is interactive content (ADR 0048 s4), spelled for the
 * message — `<button>`, `<a href>`, `<div tabindex>` — or null when it is
 * not. An attribute that decides and is bound dynamically counts as
 * present; an `input` is interactive unless its `type` is the literal
 * `"hidden"` (the default type is `text`).
 */
export const interactiveDescribeOf = (element: ElementNode): string | null => {
	const tag = element.tag
	if (
		tag === 'button' ||
		tag === 'select' ||
		tag === 'textarea' ||
		tag === 'label' ||
		tag === 'details' ||
		tag === 'iframe'
	)
		return `<${tag}>`
	if (tag === 'a' && hasAttr(element, 'href')) return '<a href>'
	// Input `type` keywords are ASCII case-insensitive (the HTML enumeration
	// rule), so the exemption lowercases before comparing.
	if (
		tag === 'input' &&
		staticAttr(element, 'type')?.toLowerCase() !== 'hidden'
	)
		return '<input>'
	if (hasAttr(element, 'tabindex')) return `<${tag} tabindex>`
	if ((tag === 'audio' || tag === 'video') && hasAttr(element, 'controls'))
		return `<${tag} controls>`
	return null
}

/**
 * Whether `source`'s component renders interactive content — its own
 * template, or one of its own composed children's, transitively (ADR 0048
 * s4). The registry-aware pass records the direct half on the entry
 * (`interactive`); this closure reads it off the entries and follows the
 * composed references in `renderedShapes`, so a compose-graph cycle stops
 * at the repeated source and a source with no entry constrains nothing
 * (LTC046 already refuses it at the compose site).
 */
export const interactiveBySource = (
	source: string,
	registry: ReadonlyMap<string, RegistryEntry>,
	seen: ReadonlySet<string>,
): boolean => {
	if (seen.has(source)) return false
	const entry = registry.get(source)
	if (!entry) return false
	if (entry.interactive) return true
	return (entry.renderedShapes ?? []).some(
		shape =>
			shape.kind === 'compose' &&
			interactiveBySource(shape.source, registry, new Set([...seen, source])),
	)
}

/**
 * Whether the component's own template renders interactive content (ADR
 * 0048 s4) — the value of its registry entry's `interactive` flag. The walk
 * enters compose content: markup the component passes at its own compose
 * sites is its own markup (ADR 0048 s1), rendered in its output. At the
 * compose node itself the child's entry is consulted first — the child's
 * own template, transitively — and the walk then continues into the passed
 * content. What a parent passes TO this component is never part of its
 * template and never reaches this walk. Without the registry (the
 * discovery pass) composed children contribute nothing at the node; their
 * entries' flags close the transitive half in the registry-aware pass,
 * where the entry that reaches `registry.json` is built.
 */
export const templateInteractiveOf = (
	root: TemplateNode,
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): boolean =>
	someNode(root, node => {
		if (node.kind === 'element') return interactiveDescribeOf(node) !== null
		if (node.kind === 'compose' && composeRegistry)
			return interactiveBySource(node.source, composeRegistry, new Set())
		return false
	})

/**
 * The first interactive finding among a compose site's literal children
 * (ADR 0048 s4): an element `interactiveDescribeOf` refuses, or a composed
 * child whose own template renders interactive content. The walk descends
 * through elements and control-flow arms — content that can render inside
 * the site — but not through a nested compose site's content: what this
 * component passes to the nested child is that site's own literal
 * children, its contract to police.
 */
export const findInteractiveContent = (
	children: readonly TemplateNode[],
	composeRegistry: ReadonlyMap<string, RegistryEntry>,
): InteractiveFinding | null => {
	for (const child of children) {
		if (child.kind === 'compose') {
			if (interactiveBySource(child.source, composeRegistry, new Set()))
				return {
					kind: 'component',
					tag: composeRegistry.get(child.source)?.tag ?? child.component,
				}
			continue
		}
		if (child.kind === 'element') {
			const describe = interactiveDescribeOf(child)
			if (describe) return { kind: 'element', describe }
		}
		const nested = findInteractiveContent(childNodes(child), composeRegistry)
		if (nested) return nested
	}
	return null
}
