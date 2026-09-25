/**
 * Selector engine (LT-022, regrouping move M5 of LE_TRUC_COMPILER.md §7):
 * synthesis, structural uniqueness counting, and union addressing for the
 * element queries the generated client factory issues. Uniqueness is proven
 * structurally against the template the compiler itself renders — the
 * compiler wrote this HTML, so counting matches in the IR is counting
 * matches in the DOM. Pure functions only; no analysis state.
 */

import type {
	ComponentIR,
	ComposedMarkup,
	ForIR,
	RenderedShape,
	TemplateNode,
} from '../ir'
import type { RegistryEntry } from '../registry'
import { walkTemplate } from '../walk'

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
 *    discriminator (`discriminatorCandidates`) only when the bare tag is
 *    structurally ambiguous.
 * Uniqueness is proven structurally — the compiler rendered this HTML.
 *
 * A third `'discriminator'` mode lived here until LT-124: a single-pick
 * variant of `discriminatorCandidates` that no caller had used since the
 * plural version landed, still carrying the exact-match `[class="…"]`
 * semantics LT-124 replaced. Deleted rather than updated — a second,
 * unreachable implementation of the discriminator rule is exactly the
 * drift LT-124 exists to remove.
 */
const buildSelector = (
	element: ElementNode,
	mode: 'role' | 'bare',
): string | null => {
	if (mode === 'bare') return element.tag
	const role = staticAttrs(element).get('role')
	if (role !== undefined && role !== null)
		return element.tag === 'div'
			? `[role="${role}"]`
			: `${element.tag}[role="${role}"]`
	return null
}

/**
 * A class token or `id` safe to spell as a `.token` / `#id` clause. Anything
 * outside this shape (a Tailwind-style `w-1/2`, a leading digit, a token with
 * a `:` or an escape) would make the synthesized selector a `querySelector`
 * syntax error — a throw at activation, not a miss — so those fall back to
 * the exact-match `[attr="value"]` form.
 */
const PLAIN_SELECTOR_TOKEN = /^[A-Za-z_-][\w-]*$/

/**
 * All discriminator candidates in priority order (`type`, each `class`
 * token, `id`, every `data-*` — the `class`-then-`id`-then-`data-*` tail
 * mirroring `composeDiscriminatorClause`'s — then every `aria-*` as a last
 * resort) — plural, because two sibling
 * `<button type="button">`s that only differ by `class` (decrement /
 * increment) share the same `type` clause: `resolveSelectorIn` needs every
 * candidate to fall through to, not just the first present one.
 *
 * Two clauses are spelled canonically rather than as attribute selectors.
 * `class` discriminates by TOKEN MEMBERSHIP (`span.label`), not by exact
 * value (LT-124), and `id` by the hash form (`input#name-input`). The two
 * are different KINDS of change: the class form deliberately matches wider
 * markup than `[class="label"]` did, while `#name-input` and
 * `[id="name-input"]` select exactly the same element — the id form is pure
 * canonicalization, carrying none of the widening discussed below.
 *
 * Exact match on `class` was wrong twice over: it made `class="a b"`
 * order-sensitive, and — since LT-123 made an unmatched optional ref a
 * silent no-op rather than a throw — it silently bound NOTHING when a page
 * enhanced the component's markup with an extra class (`class="label icon"`),
 * which is precisely the page-authored case optional refs exist to serve.
 * Token membership is also what `composeDiscriminatorClause` has always
 * emitted for compose sites; the two paths now agree on semantics, not just
 * on priority. Note this restores the contract the author wrote — the
 * authored selector in `basic-button.tsrx` is `span.label` — rather than
 * inventing a looser one.
 */
const discriminatorCandidates = (element: ElementNode): string[] => {
	const attrs = staticAttrs(element)
	const prefix = element.tag === 'div' ? '' : element.tag
	const exact = (name: string, value: string): string =>
		`${prefix}[${name}="${value}"]`
	// A Set, not an array: two unsafe tokens in one `class` value would
	// otherwise push the same exact-match fallback twice.
	const candidates = new Set<string>()
	const type = attrs.get('type')
	if (typeof type === 'string') candidates.add(exact('type', type))
	const className = attrs.get('class')
	if (typeof className === 'string') {
		const tokens = className.split(/\s+/).filter(Boolean)
		for (const token of tokens)
			candidates.add(
				PLAIN_SELECTOR_TOKEN.test(token)
					? `${prefix}.${token}`
					: exact('class', className),
			)
	}
	const id = attrs.get('id')
	if (typeof id === 'string')
		candidates.add(
			PLAIN_SELECTOR_TOKEN.test(id) ? `${prefix}#${id}` : exact('id', id),
		)
	for (const [name, value] of attrs)
		if (name.startsWith('data-') && typeof value === 'string')
			candidates.add(exact(name, value))
	// Last resort (LT-101): a static `aria-*` value, for an element whose
	// authored contract addresses it by ARIA semantics alone —
	// module-dialog's opener is `button[aria-haspopup="dialog"]`, and
	// page markup carries no class for it. Tail position means it is only
	// reached when no earlier candidate is unique, so no element that
	// resolved before changes its selector. A value holding `"` or `\`
	// would need escaping, which the matchers above do not parse.
	for (const [name, value] of attrs)
		if (
			name.startsWith('aria-') &&
			typeof value === 'string' &&
			!/["\\]/.test(value)
		)
			candidates.add(exact(name, value))
	return [...candidates]
}

/**
 * The one-clause grammar selectors are synthesized in, and the only grammar
 * `matchesSelector`/`mayMatchShape` parse: an optional tag, then at most one
 * `[attr="value"]`, `.token` or `#id` clause.
 */
const SELECTOR_GRAMMAR =
	/^([a-z][a-z0-9-]*)?(?:\[([^\]="]+)="([^"]*)"\]|\.([A-Za-z_-][\w-]*)|#([A-Za-z_-][\w-]*))?$/

/**
 * Does `candidate` structurally match a synthesized selector string?
 * Exported for LT-118's per-branch addressing collision check: a branch
 * root's query is only sound if it cannot match the OTHER branch's markup,
 * and the synthesized-selector grammar here is exactly the shape a query
 * selector can take.
 *
 * It must therefore track `discriminatorCandidates` exactly. When that
 * started emitting `.token` clauses (LT-124) this matcher's grammar had to
 * learn them in the same commit: an unparsed selector returns `false`, which
 * reads as "no collision" — so a stale matcher would not fail loudly, it
 * would quietly stop rejecting the branch-root collisions
 * `resolveExclusiveSelectorIn` calls it to catch, and effects would bind
 * onto the wrong branch's element. An unrecognized selector is a false, not
 * a throw, which is why this pairing is the load-bearing half of LT-124.
 */
export const matchesSelector = (
	candidate: ElementNode,
	selector: string,
): boolean => {
	const match = selector.match(SELECTOR_GRAMMAR)
	if (!match) return false
	const [, tag, attr, value, classToken, id] = match
	if (tag && candidate.tag !== tag) return false
	if (classToken !== undefined)
		return (staticAttrs(candidate).get('class') ?? '')
			.split(/\s+/)
			.includes(classToken)
	if (id !== undefined) return staticAttrs(candidate).get('id') === id
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
		// arms coexist in the DOM simultaneously (hidden-toggled, not
		// mutually exclusive) — sum, don't max, and include the pending arm.
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
 * composed target is the sole possible instance" used by `pass={{ }}`
 * addressing (ADR 0023 sub-design 10). Exactly 1 is the fast path: no
 * discriminator needed at all. More than 1 no longer means unaddressable
 * outright (LT-089) — `composeNodesBySource`/`composeDiscriminatorClause`
 * below can still tell same-source instances apart by a static `class`/`id`/
 * `data-*` on the compose site; this count only decides whether that search
 * is needed.
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
 * Every composed element over the whole template, regardless of source
 * (LT-090) — the source-agnostic sibling of `composeNodesBySource`, used
 * for template-wide invariants on compose sites (today: duplicate static
 * `id`). Same flat, non-exclusivity-aware collection: an `id` shared by
 * two mutually-exclusive-branch sites still renders two elements with that
 * id across the component's lifetime, so over-collecting here is the
 * conservative direction for a validity check.
 */
export const allComposeNodes = (node: TemplateNode): ComposeNode[] => {
	if (node.kind === 'if')
		return [...node.then, ...node.alternate].flatMap(allComposeNodes)
	if (node.kind === 'switch')
		return node.cases.flatMap(arm => arm.children.flatMap(allComposeNodes))
	if (node.kind === 'try')
		return [...node.children, ...node.catchChildren].flatMap(allComposeNodes)
	if (node.kind === 'compose') return [node]
	if (!isElement(node)) return []
	return node.children.flatMap(allComposeNodes)
}

/**
 * Every composed element over the whole template sharing one `.tsrx` source
 * path, as the actual nodes rather than just a count (LT-089). A flat
 * collection — unlike `countComposeBySource`, it does NOT take `@if`/
 * `@switch` mutual exclusivity into account (that count stays the "is this
 * the sole POSSIBLE instance" fast path, unchanged); this is only consulted
 * once that count is already `> 1`, to search for a static discriminator
 * (`class`/`id`/`data-*`) that tells same-source instances apart. Treating
 * two mutually-exclusive-branch instances as needing a discriminator too
 * (when in principle they never coexist) is a strictly conservative
 * over-restriction, never an incorrect acceptance — the same trade this
 * compiler already makes elsewhere when a cheaper, sound check is preferred
 * over a more complete but heavier one.
 */
export const composeNodesBySource = (
	node: TemplateNode,
	source: string,
): ComposeNode[] => {
	if (node.kind === 'if')
		return [...node.then, ...node.alternate].flatMap(child =>
			composeNodesBySource(child, source),
		)
	if (node.kind === 'switch')
		return node.cases.flatMap(arm =>
			arm.children.flatMap(child => composeNodesBySource(child, source)),
		)
	if (node.kind === 'try')
		return [...node.children, ...node.catchChildren].flatMap(child =>
			composeNodesBySource(child, source),
		)
	if (node.kind === 'compose') return node.source === source ? [node] : []
	if (!isElement(node)) return []
	return node.children.flatMap(child => composeNodesBySource(child, source))
}

/**
 * Static (`Literal`-valued) `arg` attrs of a composed element, keyed by name
 * (LT-089) — the compose-node analog of `staticAttrs` above, used to search
 * for a `class`/`id`/`data-*` discriminator among same-source siblings and,
 * since LT-127, to match an author's `first('child-tag.discriminator')`
 * selector against compose sites (`analysis/compose-refs.ts`).
 *
 * Server args to a composed child aren't guaranteed to render as real DOM
 * attributes (unlike a raw element's own `static` attrs), but `class` and
 * `id` ARE: `emit-server.ts` filters them out of the forwarded args and
 * splices them onto the child's rendered root via `composeHostAttrs`
 * (LT-090). That pass-through is now load-bearing rather than incidental —
 * addressing a compose site by `.class` is the only way to address it at
 * all — so it is an invariant, pinned by test, not an implementation
 * detail. `data-*` is spliced the same way (LT-320). A dynamic value of any
 * of the three renders but is never read here: only a literal can be
 * proven to discriminate.
 */
export const composeStaticAttrs = (node: ComposeNode): Map<string, string> => {
	const map = new Map<string, string>()
	for (const attr of node.attrs) {
		if (attr.kind !== 'arg') continue
		// A bare `class="a"` (no `{}`) classifies with `node: null` — the
		// value only survives as `exprText`, `JSON.stringify`-encoded
		// (`classify-attributes.ts`), so it round-trips safely through
		// `JSON.parse`. A braced `class={'a'}` keeps its real `node`, read
		// directly like `staticAttrs` does for raw elements above.
		if (attr.node === null) {
			try {
				const value = JSON.parse(attr.exprText)
				if (typeof value === 'string') map.set(attr.name, value)
			} catch {
				// exprText wasn't a JSON string literal — not a static value.
			}
			continue
		}
		if (attr.node.type === 'Literal' && typeof attr.node.value === 'string')
			map.set(attr.name, attr.node.value)
	}
	return map
}

/**
 * A selector-clause discriminator (`.lightness`, `#foo`, `[data-axis="x"]`)
 * that uniquely picks `node` out among `siblings` (same-source composed
 * elements, LT-089) — `class`/`id`/`data-*` priority, mirroring
 * `discriminatorCandidates`'s own priority order for raw elements. `class`
 * matches by token membership (a multi-class `class="a b"` site can be
 * discriminated by either token); `id`/`data-*` match by exact value. `null`
 * if no candidate is unique to `node`. The caller's one fallback is
 * `composeSharedPassClause` (LT-319), a query shared by sites with
 * identical `truc:pass` objects — never anything looser.
 */
export const composeDiscriminatorClause = (
	node: ComposeNode,
	siblings: readonly ComposeNode[],
): string | null =>
	composeClauseCandidates(node).find(
		candidate => composeClauseMatches(siblings, candidate).length === 1,
	)?.clause ?? null

/**
 * The same-source sites one clause of `node` picks out, for LT-319's
 * shared-query fallback: the first candidate (same priority order as
 * `composeDiscriminatorClause`) whose matching siblings ALL carry
 * `truc:pass` and would ALL reach this fallback themselves — no author
 * `first()` (`ref` attr) and no unique clause of their own (LT-339).
 * Otherwise a member addressed on its own path would either swallow the
 * group's one emission or be passed twice. `null` if no candidate
 * qualifies — the site stays unaddressable.
 */
export const composeSharedPassClause = (
	node: ComposeNode,
	siblings: readonly ComposeNode[],
): { clause: string; members: ComposeNode[] } | null => {
	for (const candidate of composeClauseCandidates(node)) {
		const members = composeClauseMatches(siblings, candidate)
		if (
			members.every(
				sib =>
					sib.attrs.some(a => a.kind === 'pass') &&
					!sib.attrs.some(a => a.kind === 'ref') &&
					composeDiscriminatorClause(sib, siblings) === null,
			)
		)
			return { clause: candidate.clause, members }
	}
	return null
}

type ClauseCandidate = { name: string; value: string; clause: string }

/** `class` tokens, then `id`, then every `data-*`: the discriminator priority. */
const composeClauseCandidates = (node: ComposeNode): ClauseCandidate[] => {
	const attrs = composeStaticAttrs(node)
	const classTokens = (attrs.get('class') ?? '').split(/\s+/).filter(Boolean)
	return [
		...classTokens.map(value => ({
			name: 'class',
			value,
			clause: `.${value}`,
		})),
		...(attrs.has('id')
			? [
					{
						name: 'id',
						value: attrs.get('id') as string,
						clause: `#${attrs.get('id')}`,
					},
				]
			: []),
		...[...attrs.keys()]
			.filter(name => name.startsWith('data-'))
			.map(name => ({
				name,
				value: attrs.get(name) as string,
				clause: `[${name}="${attrs.get(name)}"]`,
			})),
	]
}

/** The siblings `candidate` matches: `class` by token membership, the rest by exact value. */
const composeClauseMatches = (
	siblings: readonly ComposeNode[],
	{ name, value }: ClauseCandidate,
): ComposeNode[] =>
	siblings.filter(sib => {
		const sibAttrs = composeStaticAttrs(sib)
		if (name === 'class')
			return (sibAttrs.get('class') ?? '')
				.split(/\s+/)
				.filter(Boolean)
				.includes(value)
		return sibAttrs.get(name) === value
	})

/**
 * Could `selector` (the synthesized grammar `matchesSelector` parses) match
 * an element of `shape`? A dynamic attribute may hold any value, and a
 * selector outside the grammar is assumed to match — the conservative
 * direction, since a false "no" binds an effect onto a child's element.
 */
const mayMatchShape = (shape: RenderedShape, selector: string): boolean => {
	if (shape.kind !== 'element') return true
	const match = selector.match(SELECTOR_GRAMMAR)
	if (!match) return true
	const [, tag, attr, value, classToken, id] = match
	if (tag && shape.tag !== tag) return false
	const name =
		classToken !== undefined ? 'class' : id !== undefined ? 'id' : attr
	if (!name) return true
	if (shape.dynamic.includes(name)) return true
	const actual = shape.attrs[name]
	if (actual === undefined || actual === null) return false
	if (classToken !== undefined) return actual.split(/\s+/).includes(classToken)
	return actual === (id ?? value)
}

/**
 * Resolution candidates for `element`, in priority order, each paired with
 * the selector to EMIT for it. A `first()`-referenced element's authored
 * selector comes first (LT-316): page-authored occurrences are addressed by
 * the author's contract, so a synthesized selector would silently narrow or
 * widen it. It still has to prove itself like any candidate — unique over
 * the tree, and exclusion-wrapped when a composed child could match.
 * Uniqueness is counted over the component's OWN template (`base`), but the
 * runtime query also descends into every
 * composed child's rendered markup (LT-096: module-codeblock's overlay
 * resolved to a bare `button`, which found the composed basic-button's own
 * `<button>` first). With `composed` known — the registry-aware pass — a
 * candidate no composed child's element could match is emitted as is; one
 * that some could is emitted with a `:not(<child-tag> *)` exclusion per
 * such child, and dropped when a child's tag is unknown. Clean candidates
 * come first, so the exclusion only appears where no clean one is unique.
 *
 * The exclusion is sound because a composed child's markup is exactly its
 * root tag's descendants; it would also exclude an element of this
 * component that sat inside a same-tag ANCESTOR of the host, which no
 * composition produces.
 */
const selectorCandidates = (
	tree: TemplateNode,
	element: ElementNode,
	composed: ReadonlyMap<string, ComposedMarkup> | undefined,
): Array<{ base: string; emit: string }> => {
	const bases = [
		buildSelector(element, 'role'),
		buildSelector(element, 'bare'),
		...discriminatorCandidates(element),
	].filter((s): s is string => s !== null)
	const authored = authoredSelectorOf(element)
	if (!composed) {
		const synthesized = bases.map(base => ({ base, emit: base }))
		return authored
			? [{ base: authored, emit: authored }, ...synthesized]
			: synthesized
	}
	const children = allComposeNodes(tree).map(
		node => composed.get(node.source) ?? { tag: null, shapes: [] },
	)
	/** The emitted form of `base`, or null when an unknown child may match. */
	const emitFor = (base: string): { clean: boolean; emit: string } | null => {
		const clashing = children.filter(
			child =>
				child.tag === null ||
				child.shapes.some(shape => mayMatchShape(shape, base)),
		)
		if (clashing.length === 0) return { clean: true, emit: base }
		if (clashing.some(child => child.tag === null)) return null
		const tags = [...new Set(clashing.map(child => `${child.tag} *`))]
		return { clean: false, emit: `${base}:not(${tags.join(', ')})` }
	}
	const clean: Array<{ base: string; emit: string }> = []
	const excluded: Array<{ base: string; emit: string }> = []
	for (const base of bases) {
		const resolved = emitFor(base)
		if (!resolved) continue
		;(resolved.clean ? clean : excluded).push({ base, emit: resolved.emit })
	}
	// The authored selector leads even when it needs the exclusion: it is
	// the contract, and the exclusion only narrows it to this component's
	// own markup.
	const own = authored ? emitFor(authored) : null
	return [
		...(authored && own ? [{ base: authored, emit: own.emit }] : []),
		...clean,
		...excluded,
	]
}

/**
 * The element's authored `first()` selector, when it parses in the
 * synthesized grammar (LT-316) — the only selectors the structural counting
 * and the composed-shapes check can verify. Anything wider (a descendant
 * combinator, a selector list) falls back to synthesis.
 */
const authoredSelectorOf = (element: ElementNode): string | null => {
	const ref = element.attrs.find(
		(a): a is Extract<ElementNode['attrs'][number], { kind: 'ref' }> =>
			a.kind === 'ref',
	)
	const selector = ref?.selector?.trim()
	return selector && SELECTOR_GRAMMAR.test(selector) ? selector : null
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
	composed?: ReadonlyMap<string, ComposedMarkup>,
): { selector: string; unique: boolean } => {
	const candidates = selectorCandidates(tree, element, composed)
	for (const { base, emit } of candidates) {
		if (countForSelector(tree, base) === 1)
			return { selector: emit, unique: true }
	}
	return { selector: candidates[0]?.emit ?? element.tag, unique: false }
}

export const resolveSelector = (
	component: ComponentIR,
	element: ElementNode,
): { selector: string; unique: boolean } =>
	resolveSelectorIn(component.root, element, component.composedShapes)

/**
 * Does any element under `nodes` (any depth, entering nested control flow,
 * stopping at composed children — another component's template) structurally
 * match `selector`? (LT-118) — the per-branch addressing collision check:
 * a branch root's query is only sound when it cannot match the OTHER
 * branch's markup, or the branch that didn't render would have its effects
 * bound onto the sibling branch's element by its own existence guard.
 */
export const matchesUnder = (
	nodes: readonly TemplateNode[],
	selector: string,
): boolean => {
	for (const node of nodes) {
		if (node.kind === 'if') {
			if (matchesUnder([...node.then, ...node.alternate], selector)) return true
			continue
		}
		if (node.kind === 'switch') {
			for (const arm of node.cases)
				if (matchesUnder(arm.children, selector)) return true
			continue
		}
		if (node.kind === 'try') {
			if (
				matchesUnder([...node.children, ...node.catchChildren], selector) ||
				(node.pendingChildren !== null &&
					matchesUnder(node.pendingChildren, selector))
			)
				return true
			continue
		}
		if (isElement(node)) {
			if (matchesSelector(node, selector)) return true
			if (matchesUnder(node.children, selector)) return true
		}
		// 'compose', 'text', 'expr', 'client-stmt' — nothing to match.
	}
	return false
}

/**
 * Resolve the selector for an element addressed PER-BRANCH (LT-118): like
 * {@link resolveSelectorIn}, but a candidate is additionally rejected when
 * it structurally matches anything under `clash` — the sibling branch(es) of
 * the same exclusive control-flow node. `countForSelector`'s exclusivity-
 * aware counting deliberately calls a selector matching one root per branch
 * "unique" (the premise union addressing is built on); per-branch addressing
 * needs the opposite — a selector that only the addressed branch's element
 * can match — so the bare-tag candidate a same-tag sibling also matches
 * falls through to a discriminator here instead of being accepted.
 */
export const resolveExclusiveSelectorIn = (
	tree: ElementNode,
	element: ElementNode,
	clash: readonly TemplateNode[],
	composed?: ReadonlyMap<string, ComposedMarkup>,
): { selector: string; unique: boolean } => {
	const candidates = selectorCandidates(tree, element, composed)
	for (const { base, emit } of candidates) {
		if (countForSelector(tree, base) !== 1) continue
		if (matchesUnder(clash, base)) continue
		return { selector: emit, unique: true }
	}
	return { selector: candidates[0]?.emit ?? element.tag, unique: false }
}

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
		const self = resolveSelectorIn(
			component.root,
			root,
			component.composedShapes,
		)
		if (!self.unique) return { selector: self.selector, unique: false }
		if (!clauses.includes(self.selector)) clauses.push(self.selector)
	}
	return { selector: clauses.join(', '), unique: true }
}

/**
 * Every element `component`'s template can render, for its registry entry
 * (LT-096). Composed children stay references (`compose`), resolved by the
 * parent through the registry; compose-site children are the parent's own
 * elements rendered inside the child, so they are collected too. A raw
 * `children` site or a `truc:html` element renders markup the template
 * cannot know (`any`).
 */
export const renderedShapesOf = (component: ComponentIR): RenderedShape[] => {
	const shapes: RenderedShape[] = []
	let any = false
	walkTemplate(component.root, node => {
		if (node.kind === 'compose') {
			shapes.push({ kind: 'compose', source: node.source })
			return
		}
		if (node.kind === 'expr' && node.exprText === 'children') any = true
		if (node.kind !== 'element') return
		const attrs: Record<string, string | null> = {}
		const dynamic = new Set<string>()
		for (const attr of node.attrs) {
			if (attr.kind === 'static') attrs[attr.name] = attr.value
			else if (attr.kind === 'server' || attr.kind === 'reactive')
				dynamic.add(attr.name)
			else if (attr.kind === 'class-map') dynamic.add('class')
			else if (attr.kind === 'style-map') dynamic.add('style')
			else if (attr.kind === 'html') any = true
		}
		shapes.push({
			kind: 'element',
			tag: node.tag,
			attrs,
			dynamic: [...dynamic],
		})
	})
	if (any) shapes.push({ kind: 'any' })
	return shapes
}

/**
 * Each compose source under `root`, mapped to its DOM tag and every shape
 * its subtree renders — closed over the compose graph through
 * `composeRegistry` (a grandchild's markup is in the DOM too). A source with
 * no entry, or an entry without `renderedShapes`, renders unknown markup
 * (`any`).
 */
export const composedShapesFor = (
	root: TemplateNode,
	composeRegistry: ReadonlyMap<string, RegistryEntry>,
): Map<string, ComposedMarkup> => {
	const closure = (
		source: string,
		seen: ReadonlySet<string>,
	): RenderedShape[] => {
		const own = composeRegistry.get(source)?.renderedShapes
		if (!own) return [{ kind: 'any' }]
		return own.flatMap(shape =>
			shape.kind !== 'compose'
				? [shape]
				: seen.has(shape.source)
					? []
					: closure(shape.source, new Set([...seen, shape.source])),
		)
	}
	const result = new Map<string, ComposedMarkup>()
	for (const node of allComposeNodes(root))
		if (!result.has(node.source))
			result.set(node.source, {
				tag: composeRegistry.get(node.source)?.tag ?? null,
				shapes: closure(node.source, new Set([node.source])),
			})
	return result
}
