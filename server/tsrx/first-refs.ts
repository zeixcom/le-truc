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

import type { TsrxNode } from '@tsrx/core'
import { isNode } from './ast-utils'
import { type CompileDiagnostic, diagnostic } from './diagnostics'
import type { TemplateNode } from './ir'
import { walkTemplate } from './walk'

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
	candidate: { tag: string; attrs: ReadonlyMap<string, string | null> },
	parsed: SimpleSelector,
): boolean => {
	if (parsed.tag && candidate.tag !== parsed.tag) return false
	const attrs = candidate.attrs
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
 * Does `candidate` — any `{tag, attrs}` pair, so composed elements can be
 * matched too once the registry has resolved their tag (`analysis/
 * compose-refs.ts`) — structurally match an author-written selector? A
 * comma-separated list is OR semantics (matching `ElementFromSelector<S>`'s own
 * comma-union typing); each branch is a tag with any combination of
 * `.class`, `#id`, and `[attr]`/`[attr="value"]`. Returns `null` — not
 * `false` — when NO branch matches AND at least one branch used unsupported
 * syntax, so the caller can distinguish "verified: no match" from "cannot
 * verify."
 */
export const matchesAuthoredSelectorOn = (
	candidate: { tag: string; attrs: ReadonlyMap<string, string | null> },
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
			const result = matchesAuthoredSelectorOn(
				{ tag: node.tag, attrs: staticAttrs(node) },
				selectorList,
			)
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
 * Does any branch of an author-written selector list name a CUSTOM-element
 * tag (one containing a `-`)? The deferral test for LT-127: a `first()`
 * selector that matched no raw element in this component's own template,
 * but names a custom-element tag, may still be addressing a COMPOSED
 * (PascalCase) child — whose eventual tag lives in another file's registry
 * entry and is unknown inside single-file `compileSource`. Such a selector
 * is handed to the registry-aware second pass (`analysis/compose-refs.ts`)
 * instead of being rejected here; anything else is a genuine TSRX026.
 */
export const namesCustomElementTag = (selectorList: string): boolean =>
	selectorList
		.split(',')
		.some(branch => parseSimpleSelector(branch)?.tag?.includes('-') === true)

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

/**
 * TSRX039 (LT-122): report every site that renders a server arg
 * whose name is a PARSER-exposed prop — the value's own seeding
 * channel is the host attribute, so such a site is a second copy.
 *
 * The component ROOT is skipped deliberately: the root IS the host,
 * so `<form-textbox value={value}>` is the Parser's channel being
 * rendered, which is the correct half. Only OWNED descendants
 * duplicate it (`<textarea …>{value}</textarea>` beside that same
 * root attribute — form-textbox ships `value` twice today).
 */
export const reportDuplicatedChannels = (
	root: TemplateNode,
	source: string,
	diagnostics: CompileDiagnostic[],
	argNames: ReadonlySet<string>,
	parserProps: ReadonlySet<string>,
	parserFactoryOf: (prop: string) => string,
): void => {
	if (parserProps.size === 0 || argNames.size === 0) return
	const named = (expr: TsrxNode): string | null => {
		if (!isNode(expr) || expr.type !== 'Identifier') return null
		const name = String(expr.name)
		return argNames.has(name) && parserProps.has(name) ? name : null
	}
	const report = (prop: string, offset: number | undefined): void => {
		diagnostics.push(
			diagnostic.duplicatedPropChannel(
				source,
				offset,
				prop,
				parserFactoryOf(prop),
			),
		)
	}
	walkTemplate(root, node => {
		if (node.kind === 'expr') {
			const prop = named(node.expr)
			if (prop) report(prop, node.node.start)
			return
		}
		if (node.kind !== 'element' || node === root) return
		for (const attr of node.attrs) {
			if (attr.kind !== 'server') continue
			const prop = named(attr.node)
			if (prop) report(prop, attr.node.start)
		}
	})
}

/**
 * Does every path to `target` from `root` pass through an `@if`
 * with no `@else` (LT-123)? Such an element is absent from the
 * rendered DOM whenever that branch didn't take, so a reference
 * to it is optional NO MATTER how `first()` was called — the
 * analysis addresses it with a non-throwing query under a
 * presence guard (`handleOptionalBranch`, analysis/effects.ts).
 */
/**
 * The server-side condition deciding whether `refName`'s matched element
 * is in this component's OWN rendered output (LT-118) — the expression
 * text to substitute for a `Boolean(ref)` presence read when folding a
 * thunk server-side (`evaluability.ts`).
 *
 * The server renders the element exactly when every `@if` on the path to
 * it is taken, so the answer is the conjunction of those conditions
 * (negated for an `@else` arm): `'true'` when nothing guards it, `'false'`
 * when no element matches the ref at all (only a PAGE could supply it, and
 * the server did not).
 *
 * `null` — meaning "do not fold, omit the attribute instead" — for the two
 * cases the server cannot settle with a plain condition: a ref inside a
 * `@switch`/`@try` arm (arm selection is not a single boolean), and a ref
 * matched more than once (the union of several conditions is not what a
 * presence read means). Refusing to fold is always safe; folding wrongly
 * bakes a wrong initial state into the HTML.
 */
export const refBranchGuard = (
	root: TemplateNode,
	refName: string,
): string | null => {
	const found: string[][] = []
	let bailed = false
	const carriesRef = (node: TemplateNode): boolean =>
		(node.kind === 'element' || node.kind === 'compose') &&
		node.attrs.some(a => a.kind === 'ref' && a.name === refName)
	const walk = (node: TemplateNode, guards: readonly string[]): void => {
		if (bailed) return
		if (carriesRef(node)) found.push([...guards])
		if (node.kind === 'if') {
			for (const child of node.then)
				walk(child, [...guards, `(${node.testText})`])
			for (const child of node.alternate)
				walk(child, [...guards, `!(${node.testText})`])
			return
		}
		if (node.kind === 'switch' || node.kind === 'try') {
			// Arm selection is not a plain condition — if the ref lives in
			// one, refuse rather than guess.
			const arms =
				node.kind === 'switch'
					? node.cases.flatMap(arm => arm.children)
					: [
							...node.children,
							...node.catchChildren,
							...(node.pendingChildren ?? []),
						]
			for (const child of arms) if (containsRef(child, refName)) bailed = true
			return
		}
		if (node.kind === 'element' || node.kind === 'compose')
			for (const child of node.children) walk(child, guards)
	}
	const containsRef = (node: TemplateNode, name: string): boolean => {
		if (carriesRef(node)) return true
		if (node.kind === 'if')
			return [...node.then, ...node.alternate].some(c => containsRef(c, name))
		if (node.kind === 'switch')
			return node.cases.some(arm =>
				arm.children.some(c => containsRef(c, name)),
			)
		if (node.kind === 'try')
			return [
				...node.children,
				...node.catchChildren,
				...(node.pendingChildren ?? []),
			].some(c => containsRef(c, name))
		if (node.kind === 'element' || node.kind === 'compose')
			return node.children.some(c => containsRef(c, name))
		return false
	}
	walk(root, [])
	if (bailed || found.length > 1) return null
	if (found.length === 0) return 'false'
	const guards = found[0] as string[]
	return guards.length === 0 ? 'true' : guards.join(' && ')
}

export const inOptionalBranch = (
	root: TemplateNode,
	target: TemplateNode,
): boolean => {
	let found = false
	const walk = (node: TemplateNode, optional: boolean): void => {
		if (found) return
		if (node === target) {
			found = optional
			return
		}
		if (node.kind === 'if') {
			const single = node.alternate.length === 0
			for (const child of node.then) walk(child, optional || single)
			for (const child of node.alternate) walk(child, optional)
			return
		}
		if (node.kind === 'element' || node.kind === 'compose')
			for (const child of node.children) walk(child, optional)
		else if (node.kind === 'try')
			for (const child of [
				...node.children,
				...node.catchChildren,
				...(node.pendingChildren ?? []),
			])
				walk(child, optional)
		else if (node.kind === 'switch')
			for (const arm of node.cases)
				for (const child of arm.children) walk(child, optional)
	}
	walk(root, false)
	return found
}
