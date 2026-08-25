/**
 * Selector engine (LT-022, regrouping move M5 of LE_TRUC_COMPILER.md §7):
 * synthesis, structural uniqueness counting, and union addressing for the
 * element queries the generated client factory issues. Uniqueness is proven
 * structurally against the template the compiler itself renders — the
 * compiler wrote this HTML, so counting matches in the IR is counting
 * matches in the DOM. Pure functions only; no analysis state.
 */

import type { ComponentIR, ForIR, TemplateNode } from '../ir'

/* === Types === */

export type ElementNode = Extract<TemplateNode, { kind: 'element' }>
export type ExprNode = Extract<TemplateNode, { kind: 'expr' }>
export type IfNode = Extract<TemplateNode, { kind: 'if' }>
export type SwitchNode = Extract<TemplateNode, { kind: 'switch' }>
export type TryNode = Extract<TemplateNode, { kind: 'try' }>
export type ComposeNode = Extract<TemplateNode, { kind: 'compose' }>

export const isElement = (n: TemplateNode): n is ElementNode =>
	n.kind === 'element'

/* === Internal Functions === */

/** Static attributes of an element as a map (for selector synthesis). */
export const staticAttrs = (
	element: ElementNode,
): Map<string, string | null> => {
	const map = new Map<string, string | null>()
	for (const attr of element.attrs)
		if (attr.kind === 'static') map.set(attr.name, attr.value)
	return map
}

/**
 * Selector synthesis, calibrated against the hand-written corpus:
 * 1. a `role` attribute is always the discriminator (it is the element's
 *    semantic contract; `div` tags drop the tag itself);
 * 2. otherwise the bare tag, upgraded to a `type`/`class`/`data-*`
 *    discriminator only when the bare tag is structurally ambiguous.
 * Uniqueness is proven structurally — the compiler rendered this HTML.
 */
const buildSelector = (
	element: ElementNode,
	mode: 'role' | 'discriminator' | 'bare',
): string | null => {
	const attrs = staticAttrs(element)
	const clause = (name: string, value: string): string => {
		const attr = `[${name}="${value}"]`
		return element.tag === 'div' ? attr : `${element.tag}${attr}`
	}
	if (mode === 'role') {
		const role = attrs.get('role')
		if (role !== undefined && role !== null) return clause('role', role)
		return null
	}
	if (mode === 'discriminator') {
		const disc =
			['type', 'class'].find(
				name => attrs.has(name) && attrs.get(name) !== null,
			) ??
			[...attrs.keys()].find(
				name => name.startsWith('data-') && attrs.get(name) !== null,
			)
		if (disc !== undefined && attrs.get(disc) !== undefined)
			return clause(disc, attrs.get(disc) as string)
		return null
	}
	return element.tag
}

/** Does `candidate` structurally match a synthesized selector string? */
const matchesSelector = (candidate: ElementNode, selector: string): boolean => {
	const match = selector.match(
		/^([a-z][a-z0-9-]*)?(?:\[([^\]="]+)="([^"]*)"\])?$/,
	)
	if (!match) return false
	const [, tag, attr, value] = match
	if (tag && candidate.tag !== tag) return false
	if (attr) return staticAttrs(candidate).get(attr) === value
	return true
}

/* === Exported Functions === */

/** Structural match count for a selector over the whole template. */
export const countForSelector = (
	node: TemplateNode,
	selector: string,
): number => {
	if (node.kind === 'if')
		// Branches are mutually exclusive at runtime: an @if contributes the
		// max of its branch counts, never the sum (same-tag branch roots
		// would otherwise always look ambiguous).
		return Math.max(
			...[node.then, node.alternate].map(branch =>
				branch.reduce(
					(sum, child) => sum + countForSelector(child, selector),
					0,
				),
			),
		)
	if (node.kind === 'switch')
		// Same exclusivity rule, N arms.
		return Math.max(
			...node.cases.map(arm =>
				arm.children.reduce(
					(sum, child) => sum + countForSelector(child, selector),
					0,
				),
			),
		)
	if (node.kind === 'try') {
		// An async boundary (@pending present, ADR 0023 sub-design 13): all
		// three arms coexist in the DOM simultaneously (hidden-toggled, not
		// mutually exclusive) — sum, don't max, and include pendingChildren.
		if (node.pendingChildren !== null)
			return (
				node.children.reduce(
					(sum, c) => sum + countForSelector(c, selector),
					0,
				) +
				node.pendingChildren.reduce(
					(sum, c) => sum + countForSelector(c, selector),
					0,
				) +
				node.catchChildren.reduce(
					(sum, c) => sum + countForSelector(c, selector),
					0,
				)
			)
		// Plain error boundary: body XOR catch renders.
		return Math.max(
			node.children.reduce((sum, c) => sum + countForSelector(c, selector), 0),
			node.catchChildren.reduce(
				(sum, c) => sum + countForSelector(c, selector),
				0,
			),
		)
	}
	if (!isElement(node)) return 0
	let count = matchesSelector(node, selector) ? 1 : 0
	for (const child of node.children) count += countForSelector(child, selector)
	return count
}

/**
 * Structural match count for composed elements over the whole template,
 * grouped by their resolved `.tsrx` source path — the proxy for "this
 * composed target is unique" used by `pass={{ }}` addressing (ADR 0023
 * sub-design 10). Composed elements don't carry reliably-rendered static
 * attributes to build a role/discriminator selector from (they're server
 * args to the child's render call, not guaranteed DOM attributes), so only
 * the count-by-source-identity check is attempted; an author with more than
 * one instance of the same composed child needs a mechanism this milestone
 * doesn't offer yet.
 */
export const countComposeBySource = (
	node: TemplateNode,
	source: string,
): number => {
	if (node.kind === 'if')
		return Math.max(
			...[node.then, node.alternate].map(branch =>
				branch.reduce(
					(sum, child) => sum + countComposeBySource(child, source),
					0,
				),
			),
		)
	if (node.kind === 'switch')
		return Math.max(
			...node.cases.map(arm =>
				arm.children.reduce(
					(sum, child) => sum + countComposeBySource(child, source),
					0,
				),
			),
		)
	if (node.kind === 'try')
		return Math.max(
			node.children.reduce(
				(sum, c) => sum + countComposeBySource(c, source),
				0,
			),
			node.catchChildren.reduce(
				(sum, c) => sum + countComposeBySource(c, source),
				0,
			),
		)
	if (node.kind === 'compose') return node.source === source ? 1 : 0
	if (!isElement(node)) return 0
	let count = 0
	for (const child of node.children)
		count += countComposeBySource(child, source)
	return count
}

/**
 * Resolve the selector for an element: try role, bare, then upgrade to a
 * discriminator; accept the first structurally unique candidate. Counting is
 * scoped to `tree` — the whole template, or a loop output subtree for
 * bindItem-scoped element queries.
 */
export const resolveSelectorIn = (
	tree: ElementNode,
	element: ElementNode,
): { selector: string; unique: boolean } => {
	const candidates = [
		buildSelector(element, 'role'),
		buildSelector(element, 'bare'),
		buildSelector(element, 'discriminator'),
	].filter((s): s is string => s !== null)
	for (const selector of candidates) {
		if (countForSelector(tree, selector) === 1)
			return { selector, unique: true }
	}
	return { selector: candidates[0] ?? element.tag, unique: false }
}

export const resolveSelector = (
	component: ComponentIR,
	element: ElementNode,
): { selector: string; unique: boolean } =>
	resolveSelectorIn(component.root, element)

/** The `@for` loop whose output element is `node`, if any. */
export const loopFor = (
	component: ComponentIR,
	node: TemplateNode,
): ForIR | null =>
	[...component.fors.values()].find(f => f.output === node) ?? null

/**
 * The @if node whose branches hold `target` as a direct branch root, if
 * any — elements inside conditional branches address through the union
 * of all branch roots (whichever rendered is the one in the DOM).
 */
export const enclosingIfOf = (
	component: ComponentIR,
	target: ElementNode,
): IfNode | null => {
	const walk = (node: TemplateNode): IfNode | null => {
		if (node.kind === 'if') {
			if ([...node.then, ...node.alternate].includes(target)) return node
			for (const child of [...node.then, ...node.alternate]) {
				const found = walk(child)
				if (found) return found
			}
			return null
		}
		if (!isElement(node)) return null
		for (const child of node.children) {
			const found = walk(child)
			if (found) return found
		}
		return null
	}
	return walk(component.root)
}

/** Selector for an element, union-addressed when it is an @if branch root. */
export const selectorFor = (
	component: ComponentIR,
	el: ElementNode,
): { selector: string; unique: boolean } => {
	const enclosing = enclosingIfOf(component, el)
	if (!enclosing) return resolveSelector(component, el)
	const roots = [...enclosing.then, ...enclosing.alternate].filter(isElement)
	const clauses: string[] = []
	for (const root of roots) {
		// Global tree (not `root` itself) — `resolveSelectorIn` tries
		// role → bare tag → discriminator IN ORDER and stops at the first
		// one unique WITHIN the tree it's given; passing `root` as its
		// own tree made every candidate trivially "unique" (an element is
		// always unique among itself), so a same-tag sibling elsewhere in
		// the template (two plain `<p>`s, one per @if) was never caught
		// and the bare-tag candidate always won even when ambiguous.
		const self = resolveSelectorIn(component.root, root)
		if (!self.unique) return { selector: self.selector, unique: false }
		if (!clauses.includes(self.selector)) clauses.push(self.selector)
	}
	return { selector: clauses.join(', '), unique: true }
}
