/**
 * LT-245 SPIKE — materialized-probe selector engine. NOT production code:
 * this lives under server/tests/ to prove (or refute) that the five
 * hand-rolled template cascades in `analysis/selectors.ts` —
 * `countForSelector`, `countComposeBySource`, `allComposeNodes`,
 * `composeNodesBySource`, `matchesUnder` — can be replaced by
 * materializing the template the compiler renders into markup and
 * querying it with a real CSS engine (`css-select` over a `parse5` tree).
 *
 * The model: serialize the IR structurally (static attrs only, all
 * branches materialized), encode the exclusivity arithmetic in WRAPPER
 * elements instead of per-callsite recursion —
 *
 * - `<lt-group>` = mutually exclusive arms (an `@if`, an `@switch`, a
 *   `@try` without `@pending`): count = MAX over `<lt-arm>` children;
 * - coexisting content (a `@try` WITH `@pending`, an arm's interior)
 *   sums, as the DOM itself does;
 * - `<lt-pending>` marks the `@pending` arm: transparent for counting
 *   and match-existence (which include it), SKIPPED by the compose
 *   queries (which — per the current cascades — never enter it);
 * - a compose site becomes an empty `<lt-compose
 *   data-lt-compose-source="…">` placeholder: it has no DOM existence
 *   until render, it contributes 0 to raw-element counts, and it is
 *   matched/addressed only through its marker attribute.
 *
 * Matching itself — the drift-prone half (`matchesSelector`'s hand
 * grammar and its load-bearing pairing with `discriminatorCandidates`,
 COMPILER_REVIEW §2.4) — goes to css-select entirely.
 *
 * The `resolveSelector` POLICY (role → bare → discriminator candidate
 * order, authored-first, clean-before-excluded emission, the
 * `mayMatchShape` composed-shapes guard) is deliberately copied verbatim
 * from `analysis/selectors.ts`: the spike substitutes the ENGINE, not the
 * policy. A differential harness (differential.test.ts) proves the
 * answers identical over the whole corpus.
 */

import * as cssSelect from 'css-select'
import { parseFragment } from 'parse5'
import type { ComposeNode } from '../../../compiler/analysis/selectors'
import { staticAttrs } from '../../../compiler/analysis/selectors'
import type {
	ComposedMarkup,
	RenderedShape,
	TemplateNode,
} from '../../../compiler/ir'

/* === Types === */

/** Minimal structural view of a parse5 element/document-fragment node. */
type P5Node = {
	nodeName: string
	tagName?: string
	attrs?: Array<{ name: string; value: string }>
	childNodes?: P5Node[]
	parentNode?: P5Node | null
	value?: string
}
type P5Element = P5Node & {
	tagName: string
	attrs: Array<{ name: string; value: string }>
}

/* === css-select adapter over parse5 trees === */

const isTag = (node: P5Node): node is P5Element => node.tagName !== undefined

const elementChildren = (node: P5Node): P5Element[] =>
	(node.childNodes ?? []).filter(isTag)

type CssAdapter = NonNullable<
	import('css-select').Options<P5Node, P5Element>['adapter']
>

const adapter: CssAdapter = {
	isTag,
	getAttributeValue: (elem: P5Element, name: string): string | undefined =>
		elem.attrs.find(a => a.name === name)?.value,
	getChildren: (node: P5Node): P5Node[] => node.childNodes ?? [],
	getName: (elem: P5Element): string => elem.tagName,
	getParent: (node: P5Node): P5Node | null => node.parentNode ?? null,
	getSiblings: (node: P5Node): P5Node[] =>
		node.parentNode?.childNodes ?? [node],
	getText: (node: P5Node): string =>
		(node.childNodes ?? [])
			.map(child =>
				child.nodeName === '#text' ? (child.value ?? '') : getTextOf(child),
			)
			.join(''),
	hasAttrib: (elem: P5Element, name: string): boolean =>
		elem.attrs.some(a => a.name === name),
	prevElementSibling: (node: P5Node): P5Element | null => {
		const siblings = adapter.getSiblings(node) as P5Node[]
		const index = siblings.indexOf(node)
		for (let i = index - 1; i >= 0; i--)
			if (isTag(siblings[i] as P5Node)) return siblings[i] as P5Element
		return null
	},
	removeSubsets: (nodes: P5Node[]): P5Node[] =>
		nodes.filter(
			node => !nodes.some(other => other !== node && containsNode(other, node)),
		),
}

const getTextOf = (node: P5Node): string => adapter.getText(node)

const containsNode = (ancestor: P5Node, node: P5Node): boolean => {
	let current: P5Node | null | undefined = node
	while (current) {
		if (current === ancestor) return true
		current = current.parentNode
	}
	return false
}

/* === Materializer === */

/** HTML void elements: parse5 reparents their "children" as siblings. */
const VOID_TAGS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
])

const LT_GROUP = 'lt-group'
const LT_ARM = 'lt-arm'
const LT_SUM = 'lt-sum'
const LT_PENDING = 'lt-pending'
const LT_COMPOSE = 'lt-compose'
const SOURCE_ATTR = 'data-lt-compose-source'

const escapeAttr = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')

type Frag = {
	root: P5Node
	/** Compose placeholder element → the IR compose node it stands for. */
	composeByEl: Map<P5Node, ComposeNode>
}


/**
 * Materialize `nodes` into an HTML fragment string. Static attrs only —
 * the cascades' matchers read statics alone (a dynamic attribute never
 * matches a synthesized static selector). Wrappers encode the branch
 * semantics; see the module doc.
 */
const serializeNodes = (
	nodes: readonly TemplateNode[],
	out: string[],
): void => {
	for (const node of nodes) {
		switch (node.kind) {
			case 'element': {
				const attrs: string[] = []
				for (const attr of node.attrs)
					if (attr.kind === 'static')
						attrs.push(
							attr.value === null
								? attr.name
								: `${attr.name}="${escapeAttr(attr.value)}"`,
						)
				const open = `<${node.tag}${attrs.length ? ' ' : ''}${attrs.join(' ')}>`
				if (VOID_TAGS.has(node.tag)) {
					// A browser reparents a void tag's children to following
					// siblings; the probe matches browser reality.
					out.push(open)
					serializeNodes(node.children, out)
				} else {
					out.push(open)
					serializeNodes(node.children, out)
					out.push(`</${node.tag}>`)
				}
				break
			}
			case 'compose':
				out.push(
					`<${LT_COMPOSE} ${SOURCE_ATTR}="${escapeAttr(node.source)}"></${LT_COMPOSE}>`,
				)
				break
			case 'if': {
				out.push(`<${LT_GROUP}>`)
				for (const branch of [node.then, node.alternate]) {
					out.push(`<${LT_ARM}>`)
					serializeNodes(branch, out)
					out.push(`</${LT_ARM}>`)
				}
				out.push(`</${LT_GROUP}>`)
				break
			}
			case 'switch': {
				out.push(`<${LT_GROUP}>`)
				for (const arm of node.cases) {
					out.push(`<${LT_ARM}>`)
					serializeNodes(arm.children, out)
					out.push(`</${LT_ARM}>`)
				}
				out.push(`</${LT_GROUP}>`)
				break
			}
			case 'try': {
				if (node.pendingChildren !== null) {
					// Async boundary: all three arms coexist (hidden-toggled) —
					// sum, pending wrapped so compose queries can skip it.
					out.push(`<${LT_SUM}>`)
					serializeNodes(node.children, out)
					serializeNodes(node.catchChildren, out)
					out.push(`<${LT_PENDING}>`)
					serializeNodes(node.pendingChildren, out)
					out.push(`</${LT_PENDING}>`)
					out.push(`</${LT_SUM}>`)
				} else {
					// Plain error boundary: body XOR catch.
					out.push(`<${LT_GROUP}>`)
					for (const branch of [node.children, node.catchChildren]) {
						out.push(`<${LT_ARM}>`)
						serializeNodes(branch, out)
						out.push(`</${LT_ARM}>`)
					}
					out.push(`</${LT_GROUP}>`)
				}
				break
			}
			default:
				// text, expr, client-stmt — no element, nothing to match.
				break
		}
	}
}

const nodeArrayCache = new WeakMap<readonly TemplateNode[], Frag>()

const fragOf = (nodes: readonly TemplateNode[]): Frag => {
	// Branch/child arrays are stable IR references; a fresh array (e.g. a
	// spread in a caller) just misses the cache and re-serializes.
	const existing = nodeArrayCache.get(nodes)
	if (existing) return existing
	const out: string[] = []
	serializeNodes(nodes, out)
	const root = parseFragment(out.join('')) as unknown as P5Node
	// Map placeholders back to IR compose nodes by document order — the
	// serializer emits them pre-order, the parser preserves it.
	const placeholders = cssSelect.selectAll(
		`[${SOURCE_ATTR}]`,
		elementChildren(root),
		{ adapter },
	)
	const composeNodes: ComposeNode[] = []
	collectCompose(nodes, composeNodes)
	const composeByEl = new Map<P5Node, ComposeNode>()
	placeholders.forEach((el, index) =>
		composeByEl.set(el, composeNodes[index] as ComposeNode),
	)
	const frag = { root, composeByEl }
	nodeArrayCache.set(nodes, frag)
	return frag
}

const collectCompose = (nodes: readonly TemplateNode[], out: ComposeNode[]) => {
	for (const node of nodes) {
		if (node.kind === 'compose') out.push(node)
		else if (node.kind === 'element') collectCompose(node.children, out)
		else if (node.kind === 'if')
			collectCompose([...node.then, ...node.alternate], out)
		else if (node.kind === 'switch')
			collectCompose(
				node.cases.flatMap(a => a.children),
				out,
			)
		else if (node.kind === 'try')
			collectCompose([...node.children, ...node.catchChildren], out)
	}
}

/** Fragment for a whole subtree root (element/kind-bearing single node). */
const fragForRoot = (root: TemplateNode): Frag => fragOf([root])

/* === The one aggregation walk === */

/** Compile with the adapter baked in; ReturnType names the query type. */
const compileQuery = (selector: string) =>
	cssSelect.compile(selector, { adapter })
type CompiledQuery = ReturnType<typeof compileQuery>

const countIn = (node: P5Node, query: CompiledQuery): number => {
	if (node.nodeName === '#document-fragment')
		return elementChildren(node)
			.map(child => countIn(child, query))
			.reduce((a, b) => a + b, 0)
	if (!isTag(node)) return 0
	const name = node.tagName as string
	if (name === LT_GROUP)
		return Math.max(0, ...elementChildren(node).map(arm => countIn(arm, query)))
	if (name === LT_ARM || name === LT_SUM || name === LT_PENDING)
		return elementChildren(node)
			.map(child => countIn(child, query))
			.reduce((a, b) => a + b, 0)
	if (name === LT_COMPOSE) return 0
	return (
		(cssSelect.is(node, query) ? 1 : 0) +
		elementChildren(node)
			.map(child => countIn(child, query))
			.reduce((a, b) => a + b, 0)
	)
}

/* === Probe-side cascades (the five hand walks' replacements) === */

/** `countForSelector` over the materialized probe. */
export const probeCountForSelector = (
	root: TemplateNode,
	selector: string,
): number => {
	const { root: fragRoot } = fragForRoot(root)
	return countIn(fragRoot, compileQuery(selector))
}

/** `matchesUnder` — pure existence, exclusivity can never flip it. */
export const probeMatchesUnder = (
	nodes: readonly TemplateNode[],
	selector: string,
): boolean => {
	const { root: fragRoot } = fragOf(nodes)
	return (
		cssSelect.selectAll(selector, elementChildren(fragRoot), {
			adapter,
		}).length > 0
	)
}

/**
 * `countComposeBySource` — compose placeholders are addressed by their
 * marker attribute. Compose queries must NOT see `<lt-pending>` content
 * (the current cascades never enter a pending arm), so the pending arm is
 * stripped from a compose-counting view. The aggregation walk simply never
 * counts inside `lt-pending` for this query family.
 */
const countComposeIn = (node: P5Node, query: CompiledQuery): number => {
	if (node.nodeName === '#document-fragment')
		return elementChildren(node)
			.map(child => countComposeIn(child, query))
			.reduce((a, b) => a + b, 0)
	if (!isTag(node)) return 0
	const name = node.tagName as string
	if (name === LT_PENDING) return 0
	if (name === LT_GROUP)
		return Math.max(
			0,
			...elementChildren(node).map(arm => countComposeIn(arm, query)),
		)
	if (name === LT_ARM || name === LT_SUM)
		return elementChildren(node)
			.map(child => countComposeIn(child, query))
			.reduce((a, b) => a + b, 0)
	if (name === LT_COMPOSE) return cssSelect.is(node, query, { adapter }) ? 1 : 0
	return elementChildren(node)
		.map(child => countComposeIn(child, query))
		.reduce((a, b) => a + b, 0)
}

export const probeCountComposeBySource = (
	root: TemplateNode,
	source: string,
): number => {
	const { root: fragRoot } = fragForRoot(root)
	return countComposeIn(
		fragRoot,
		compileQuery(`[${SOURCE_ATTR}="${escapeAttr(source)}"]`),
	)
}

/** `allComposeNodes` — document order, pending arms excluded, compose not entered. */
export const probeAllComposeNodes = (root: TemplateNode): ComposeNode[] => {
	const { root: fragRoot, composeByEl } = fragForRoot(root)
	return cssSelect
		.selectAll(`[${SOURCE_ATTR}]`, elementChildren(fragRoot), { adapter })
		.filter(n => !isInsidePending(n))
		.map(n => composeByEl.get(n) as ComposeNode)
}

const isInsidePending = (node: P5Node): boolean => {
	let current: P5Node | null | undefined = node.parentNode
	while (current) {
		if (current.tagName === LT_PENDING) return true
		current = current.parentNode
	}
	return false
}

export const probeComposeNodesBySource = (
	root: TemplateNode,
	source: string,
): ComposeNode[] =>
	probeAllComposeNodes(root).filter(node => node.source === source)

/* === Probe-side resolve policy (copied verbatim from selectors.ts) === */

const buildSelector = (
	element: Extract<TemplateNode, { kind: 'element' }>,
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

const PLAIN_SELECTOR_TOKEN = /^[A-Za-z_-][\w-]*$/

const discriminatorCandidates = (
	element: Extract<TemplateNode, { kind: 'element' }>,
): string[] => {
	const attrs = staticAttrs(element)
	const prefix = element.tag === 'div' ? '' : element.tag
	const exact = (name: string, value: string): string =>
		`${prefix}[${name}="${value}"]`
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
	for (const [name, value] of attrs)
		if (
			name.startsWith('aria-') &&
			typeof value === 'string' &&
			!/["\\]/.test(value)
		)
			candidates.add(exact(name, value))
	return [...candidates]
}

const SELECTOR_GRAMMAR =
	/^([a-z][a-z0-9-]*)?(?:\[([^\]="]+)="([^"]*)"\]|\.([A-Za-z_-][\w-]*)|#([A-Za-z_-][\w-]*))?$/

const authoredSelectorOf = (
	element: Extract<TemplateNode, { kind: 'element' }>,
): string | null => {
	const ref = element.attrs.find(a => a.kind === 'ref') as
		| { kind: 'ref'; selector?: string | null }
		| undefined
	const selector = ref?.selector?.trim()
	return selector && SELECTOR_GRAMMAR.test(selector) ? selector : null
}

const mayMatchShape = (shape: RenderedShape, selector: string): boolean => {
	if (shape.kind !== 'element') return true
	const match = selector.match(SELECTOR_GRAMMAR)
	if (!match) return true
	const [, tag, attr, value, classToken, id] = match
	if (tag && shape.tag !== tag) return false
	const name =
		classToken !== undefined ? 'class' : id !== undefined ? 'id' : attr
	if (!name) return true
	if (shape.dynamic?.includes(name)) return true
	const actual = shape.attrs?.[name]
	if (actual === undefined || actual === null) return false
	if (classToken !== undefined) return actual.split(/\s+/).includes(classToken)
	return actual === (id ?? value)
}

const selectorCandidates = (
	tree: TemplateNode,
	element: Extract<TemplateNode, { kind: 'element' }>,
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
	const children = probeAllComposeNodes(tree).map(
		node => composed.get(node.source) ?? { tag: null, shapes: [] },
	)
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
	const own = authored ? emitFor(authored) : null
	return [
		...(authored && own ? [{ base: authored, emit: own.emit }] : []),
		...clean,
		...excluded,
	]
}

type ElementNode = Extract<TemplateNode, { kind: 'element' }>

export const probeResolveSelectorIn = (
	tree: ElementNode,
	element: ElementNode,
	composed?: ReadonlyMap<string, ComposedMarkup>,
): { selector: string; unique: boolean } => {
	const candidates = selectorCandidates(tree, element, composed)
	for (const { base, emit } of candidates) {
		if (probeCountForSelector(tree, base) === 1)
			return { selector: emit, unique: true }
	}
	return { selector: candidates[0]?.emit ?? element.tag, unique: false }
}

export const probeResolveExclusiveSelectorIn = (
	tree: ElementNode,
	element: ElementNode,
	clash: readonly TemplateNode[],
	composed?: ReadonlyMap<string, ComposedMarkup>,
): { selector: string; unique: boolean } => {
	const candidates = selectorCandidates(tree, element, composed)
	for (const { base, emit } of candidates) {
		if (probeCountForSelector(tree, base) !== 1) continue
		if (probeMatchesUnder(clash, base)) continue
		return { selector: emit, unique: true }
	}
	return { selector: candidates[0]?.emit ?? element.tag, unique: false }
}

type IfNode = Extract<TemplateNode, { kind: 'if' }>

export const probeEnclosingIfOf = (
	root: TemplateNode,
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

export const probeSelectorFor = (
	root: ElementNode,
	el: ElementNode,
	composed?: ReadonlyMap<string, ComposedMarkup>,
): { selector: string; unique: boolean } => {
	const enclosing = probeEnclosingIfOf(root, el)
	if (!enclosing) return probeResolveSelectorIn(root, el, composed)
	const roots = [...enclosing.then, ...enclosing.alternate].filter(
		(n): n is ElementNode => n.kind === 'element',
	)
	const clauses: string[] = []
	for (const rootEl of roots) {
		const self = probeResolveSelectorIn(root, rootEl, composed)
		if (!self.unique) return { selector: self.selector, unique: false }
		if (!clauses.includes(self.selector)) clauses.push(self.selector)
	}
	return { selector: clauses.join(', '), unique: true }
}
