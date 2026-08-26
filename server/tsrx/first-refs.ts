/**
 * `first(selector, required)` element-reference resolution (LT-055,
 * replacing `ref={}`). A front-end-owned pure leaf, sibling of
 * `reactivity.ts`/`evaluability.ts`: `compiler.ts` calls this once the
 * template IR exists (`lowerChildren` has run) to structurally match an
 * author's selector against the component's own template, before attaching
 * the matched element(s) to the same `{kind: 'ref', name}` IR shape
 * `ref={}` used to populate directly. Depends only on `ir.ts` types, so
 * both the front end and (if ever needed) the analysis layer can import it
 * without crossing the pipeline's documented front-end → analysis
 * direction the other way.
 *
 * The author's selector is used ONLY here, at compile time, to identify
 * WHICH element(s) a `first()`-declared name refers to. It is never emitted
 * as the runtime selector — `analysis/selectors.ts`'s `resolveSelectorIn`/
 * `selectorFor` still synthesize that, exactly as for `ref={}` before it,
 * so every existing dedup/union-addressing guarantee carries over unchanged.
 */

import type { TemplateNode } from './ir'

/* === Types === */

export type ElementNode = Extract<TemplateNode, { kind: 'element' }>
type IfNode = Extract<TemplateNode, { kind: 'if' }>

/** One `.class`/`#id`/`[attr]`/`[attr="value"]` clause, or a bare tag name. */
type SimpleSelector = {
	tag: string | null
	id: string | null
	classes: string[]
	attrs: Array<{ name: string; value: string | null }>
}

/* === Internal Functions === */

/** Static attributes of an element as a map (mirrors `analysis/selectors.ts`). */
const staticAttrs = (element: ElementNode): Map<string, string | null> => {
	const map = new Map<string, string | null>()
	for (const attr of element.attrs)
		if (attr.kind === 'static') map.set(attr.name, attr.value)
	return map
}

/**
 * Parse ONE simple selector (no combinators, no pseudo-classes) into its
 * structural parts. Supports an optional tag followed by any combination of
 * `.class`, `#id`, and `[attr]`/`[attr="value"]` clauses, in any order.
 * Returns `null` for anything richer (descendant/child combinators,
 * pseudo-classes, attribute operators other than `=`) — the caller must
 * treat `null` as "cannot verify structurally," never as "matches nothing."
 */
const parseSimpleSelector = (selector: string): SimpleSelector | null => {
	const trimmed = selector.trim()
	if (trimmed === '') return null
	const tagMatch = trimmed.match(/^[a-z][a-z0-9-]*/)
	const tag = tagMatch ? tagMatch[0] : null
	const rest = tag ? trimmed.slice(tag.length) : trimmed
	if (rest === '') return tag ? { tag, id: null, classes: [], attrs: [] } : null
	const clausePattern =
		/\.[a-zA-Z_-][\w-]*|#[a-zA-Z_-][\w-]*|\[[a-zA-Z_-][\w-]*(?:="[^"]*")?\]/g
	const clauses = rest.match(clausePattern) ?? []
	// The pattern must fully consume `rest` — a leftover fragment means a
	// combinator, a pseudo-class, or an operator this subset doesn't cover.
	if (clauses.join('') !== rest) return null
	const classes: string[] = []
	let id: string | null = null
	const attrs: Array<{ name: string; value: string | null }> = []
	for (const clause of clauses) {
		if (clause.startsWith('.')) classes.push(clause.slice(1))
		else if (clause.startsWith('#')) id = clause.slice(1)
		else {
			const m = clause.match(/^\[([a-zA-Z_-][\w-]*)(?:="([^"]*)")?\]$/)
			if (!m) return null
			attrs.push({ name: m[1] as string, value: m[2] ?? null })
		}
	}
	return { tag, id, classes, attrs }
}

const matchesSimpleSelector = (
	candidate: ElementNode,
	parsed: SimpleSelector,
): boolean => {
	if (parsed.tag && candidate.tag !== parsed.tag) return false
	const attrs = staticAttrs(candidate)
	if (parsed.id !== null && attrs.get('id') !== parsed.id) return false
	if (parsed.classes.length > 0) {
		const classList = (attrs.get('class') ?? '').split(/\s+/).filter(Boolean)
		if (!parsed.classes.every(c => classList.includes(c))) return false
	}
	for (const attr of parsed.attrs) {
		if (!attrs.has(attr.name)) return false
		if (attr.value !== null && attrs.get(attr.name) !== attr.value) return false
	}
	return true
}

/**
 * Does `candidate` structurally match an author-written selector? A comma-
 * separated list is OR semantics (matching `ElementFromSelector<S>`'s own
 * comma-union typing); each branch is a tag with any combination of
 * `.class`, `#id`, and `[attr]`/`[attr="value"]`. Returns `null` — not
 * `false` — when NO branch matches AND at least one branch used unsupported
 * syntax, so the caller can distinguish "verified: no match" from "cannot
 * verify."
 */
const matchesAuthoredSelector = (
	candidate: ElementNode,
	selectorList: string,
): boolean | null => {
	let anyUnsupported = false
	for (const branch of selectorList.split(',')) {
		const parsed = parseSimpleSelector(branch)
		if (!parsed) {
			anyUnsupported = true
			continue
		}
		if (matchesSimpleSelector(candidate, parsed)) return true
	}
	return anyUnsupported ? null : false
}

/* === Exported Functions === */

/**
 * Every element in `root` matching an author-written selector. Composed
 * elements are a boundary — their own template is a different component,
 * so the walk doesn't enter them, mirroring `collectComposeElements`'s
 * `intoCompose: false`.
 */
export const collectMatchingElements = (
	root: ElementNode,
	selectorList: string,
): { elements: ElementNode[]; unsupported: boolean } => {
	const elements: ElementNode[] = []
	let unsupported = false
	const visit = (node: TemplateNode): void => {
		if (node.kind === 'element') {
			const result = matchesAuthoredSelector(node, selectorList)
			if (result === null) unsupported = true
			else if (result) elements.push(node)
			for (const child of node.children) visit(child)
			return
		}
		if (node.kind === 'if') {
			for (const child of node.then) visit(child)
			for (const child of node.alternate) visit(child)
			return
		}
		if (node.kind === 'switch') {
			for (const arm of node.cases)
				for (const child of arm.children) visit(child)
			return
		}
		if (node.kind === 'try') {
			for (const child of node.children) visit(child)
			for (const child of node.catchChildren) visit(child)
			if (node.pendingChildren)
				for (const child of node.pendingChildren) visit(child)
			return
		}
		// 'compose', 'text', 'expr', 'client-stmt' — nothing to match/recurse.
	}
	visit(root)
	return { elements, unsupported }
}

/**
 * The nearest enclosing `@if` whose branches (`then`/`alternate`) directly
 * contain `target`, searching from `root`.
 */
const enclosingIfIn = (
	root: ElementNode,
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
		if (node.kind !== 'element') return null
		for (const child of node.children) {
			const found = walk(child)
			if (found) return found
		}
		return null
	}
	return walk(root)
}

/**
 * Are all of `elements` mutually exclusive at runtime — direct branch roots
 * of the SAME `@if`, at most one per branch? This is the structural shape
 * `first('input, textarea', 'required')` needs when the referenced element
 * differs by tag across an `@if`/`@else` — the same "whichever branch
 * rendered" guarantee `analysis/selectors.ts`'s `selectorFor` union
 * addressing already relies on elsewhere, scoped here to DIRECT branch
 * roots only, matching that existing precedent.
 */
export const shareExclusiveIf = (
	root: ElementNode,
	elements: ElementNode[],
): boolean => {
	if (elements.length < 2) return true
	const [first, ...rest] = elements.map(el => enclosingIfIn(root, el))
	if (!first || rest.some(e => e !== first)) return false
	const inThen = elements.filter(el => first.then.includes(el))
	const inAlternate = elements.filter(el => first.alternate.includes(el))
	return (
		inThen.length <= 1 &&
		inAlternate.length <= 1 &&
		inThen.length + inAlternate.length === elements.length
	)
}
