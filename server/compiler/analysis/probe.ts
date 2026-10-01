/**
 * The materialized-probe selector engine (LT-379, [ADR
 * 0045](../../../adr/0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md);
 * promoted from the LT-245 spike). The structural-uniqueness proof does not
 * walk the template IR by hand — it serializes the template the compiler
 * renders to HTML, parses that with parse5, and answers matching, counting,
 * and match-existence with [css-select](https://github.com/fb55/css-select)
 * over one aggregation walk. The premise is unchanged: the compiler wrote
 * this HTML, so counting matches in the probe is counting matches in the
 * DOM — and per ADR 0045 Decision 2 the probe is BROWSER-FAITHFUL: it
 * counts what a browser's parse of the emitted markup builds, not what the
 * authored nesting says. Valid authoring never diverges; the one divergence
 * class (content-model-violating nesting, e.g. `<p><div>…</div></p>`) is
 * pinned as documentation in `server/tests/compiler/
 * probe-differential.test.ts`.
 *
 * The serialization encodes the branch-exclusivity arithmetic in WRAPPER
 * elements instead of per-callsite recursion — the one place the max-vs-sum
 * rule lives:
 *
 * - `<lt-group>` = mutually exclusive arms (an `@if`, an `@switch`, a
 *   `@try` without `@pending`): count = MAX over `<lt-arm>` children;
 * - coexisting content (a `@try` WITH `@pending`, an arm's interior) sums,
 *   as the DOM itself does — LT-230's recorded `@pending` policy: every
 *   walk enters the arm, there is no skipped-arm divergence;
 * - a compose site becomes an empty `<lt-compose
 *   data-lt-compose-source="…">` placeholder: it has no DOM existence
 *   until render, contributes 0 to raw-element counts, and is
 *   matched/addressed only through its marker attribute.
 *
 * Matching itself — the drift-prone half of the hand cascades
 * (COMPILER_REVIEW §2.4) — is delegated to css-select entirely. The
 * selector POLICY (candidate order, compose clause algebra, the
 * element-chain searches) stays in `analysis/selectors.ts`; this module is
 * the engine those policy functions query.
 *
 * css-select v7 gotchas pinned by the spike, all handled here: the Adapter
 * interface lost `findAll`/`findOne`/`existsOne`/`getParents`/
 * `nextElementSibling` (the adapter below is the small replacement);
 * `getAttributeValue` returns `undefined`, not `null`; `isTag` must be a
 * TS type predicate; traversal skips non-tag roots (queries run against the
 * fragment's element children) and — in HTML mode — ignores the CONTENTS
 * of `<template>` elements. No component may author a `<template>` (or an
 * element named like a wrapper): the materializer fails loud rather than
 * answer from a tree the engine would silently mis-traverse.
 *
 * Pure functions only; no analysis state beyond the fragment caches.
 */

import * as cssSelect from 'css-select'
import { parseFragment } from 'parse5'
import type { TemplateNode } from '../ir'
import { walkTemplate } from '../walk'
import type { ComposeNode } from './selectors'

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
				child.nodeName === '#text'
					? (child.value ?? '')
					: adapter.getText(child),
			)
			.join(''),
	hasAttrib: (elem: P5Element, name: string): boolean =>
		elem.attrs.some(a => a.name === name),
	prevElementSibling: (node: P5Node): P5Element | null => {
		const siblings = node.parentNode?.childNodes ?? []
		const index = siblings.indexOf(node)
		for (let i = index - 1; i >= 0; i--) {
			const sibling = siblings[i]
			if (sibling && isTag(sibling)) return sibling
		}
		return null
	},
	removeSubsets: (nodes: P5Node[]): P5Node[] =>
		nodes.filter(
			node => !nodes.some(other => other !== node && containsNode(other, node)),
		),
}

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
const LT_COMPOSE = 'lt-compose'
const SOURCE_ATTR = 'data-lt-compose-source'

/** Tags the serializer owns; an authored element with one of these names
 * would collide with the wrapper semantics (or, for `<template>`, with
 * css-select's HTML-mode content skipping). */
const REFUSED_TAGS = new Set([LT_GROUP, LT_ARM, LT_SUM, LT_COMPOSE])

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
 * a synthesized/authored selector the proof counts is static, and a
 * dynamic attribute never matches one. Wrappers encode the branch
 * semantics; see the module doc.
 */
const serializeNodes = (
	nodes: readonly TemplateNode[],
	out: string[],
): void => {
	for (const node of nodes) {
		switch (node.kind) {
			case 'element': {
				if (node.tag === 'template')
					throw new Error(
						`LT-379 probe: the template authors a <template> element, whose content css-select's HTML-mode traversal silently skips — the proof refuses to answer from a mis-traversed tree. (Reactive-list loops diagnose this case structurally; for other components this invariant tripwire awaits a proper authored-<template> diagnostic.)`,
					)
				if (REFUSED_TAGS.has(node.tag))
					throw new Error(
						`LT-379 probe: the template authors an <${node.tag}> element, whose name the probe reserves for its own branch wrappers.`,
					)
				const attrs: string[] = []
				for (const attr of node.attrs)
					if (attr.kind === 'static')
						attrs.push(
							attr.value === null
								? attr.name
								: `${attr.name}="${escapeAttr(attr.value)}"`,
						)
				out.push(`<${node.tag}${attrs.length ? ' ' : ''}${attrs.join(' ')}>`)
				// A browser reparents a void tag's children to following
				// siblings; the probe matches browser reality either way.
				serializeNodes(node.children, out)
				if (!VOID_TAGS.has(node.tag)) out.push(`</${node.tag}>`)
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
					// sum (LT-230's `@pending` policy: every walk enters the
					// arm; there is no skipped pending arm to wrap).
					out.push(`<${LT_SUM}>`)
					serializeNodes(node.children, out)
					serializeNodes(node.catchChildren, out)
					serializeNodes(node.pendingChildren, out)
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

/**
 * Fragments are cached per root: `resolveSelectorIn` counts every candidate
 * against the same tree, and branch/child arrays are stable IR references
 * (a fresh array from a caller just misses the array cache and
 * re-serializes).
 */
const fragByNode = new WeakMap<TemplateNode, Frag>()
const fragByArray = new WeakMap<readonly TemplateNode[], Frag>()

const fragOfRoot = (root: TemplateNode): Frag => {
	let frag = fragByNode.get(root)
	if (!frag) {
		const out: string[] = []
		serializeNodes([root], out)
		const p5Root = parseFragment(out.join('')) as unknown as P5Node
		// Map placeholders back to IR compose nodes by document order — the
		// serializer emits them pre-order, the parser preserves it, and
		// `walkTemplate` (composition a boundary) walks the same pre-order.
		const composeNodes: ComposeNode[] = []
		walkTemplate(
			root,
			node => {
				if (node.kind === 'compose') composeNodes.push(node)
			},
			{ intoCompose: false },
		)
		const composeByEl = new Map<P5Node, ComposeNode>()
		cssSelect
			.selectAll(`[${SOURCE_ATTR}]`, elementChildren(p5Root), { adapter })
			.forEach((el, index) =>
				composeByEl.set(el, composeNodes[index] as ComposeNode),
			)
		frag = { root: p5Root, composeByEl }
		fragByNode.set(root, frag)
	}
	return frag
}

/** Arm/branch node lists materialize without the compose mapping — the
 * existence query never addresses placeholders. */
const fragOfNodes = (nodes: readonly TemplateNode[]): Frag => {
	let frag = fragByArray.get(nodes)
	if (!frag) {
		const out: string[] = []
		serializeNodes(nodes, out)
		frag = {
			root: parseFragment(out.join('')) as unknown as P5Node,
			composeByEl: new Map(),
		}
		fragByArray.set(nodes, frag)
	}
	return frag
}

/* === The one aggregation walk === */

/** Compile with the adapter baked in; ReturnType names the query type. */
const compileQuery = (selector: string) =>
	cssSelect.compile(selector, { adapter })
type CompiledQuery = ReturnType<typeof compileQuery>

const queryCache = new Map<string, CompiledQuery | null>()

/**
 * A compiled query, or `null` when css-what cannot parse the selector. A
 * querySelector would THROW on such a string, so it matches nothing in any
 * valid DOM — `null` counts as zero matches / no existence, the same answer
 * the hand grammar's "unparsed" path gave before LT-379.
 */
const queryOf = (selector: string): CompiledQuery | null => {
	if (!queryCache.has(selector)) {
		try {
			queryCache.set(selector, compileQuery(selector))
		} catch {
			queryCache.set(selector, null)
		}
	}
	return queryCache.get(selector) ?? null
}

const sumChildren = (node: P5Node, query: CompiledQuery): number =>
	elementChildren(node)
		.map(child => countIn(child, query))
		.reduce((a, b) => a + b, 0)

const countIn = (node: P5Node, query: CompiledQuery): number => {
	if (node.nodeName === '#document-fragment') return sumChildren(node, query)
	if (!isTag(node)) return 0
	switch (node.tagName) {
		case LT_GROUP:
			// Mutually exclusive arms: max, never sum.
			return Math.max(
				0,
				...elementChildren(node).map(arm => countIn(arm, query)),
			)
		case LT_ARM:
		case LT_SUM:
			return sumChildren(node, query)
		case LT_COMPOSE:
			// A placeholder has no DOM existence until render.
			return 0
		default:
			return (cssSelect.is(node, query) ? 1 : 0) + sumChildren(node, query)
	}
}

/* === Exported Functions === */

/** `countForSelector` over the materialized probe (`analysis/selectors.ts`). */
export const probeCount = (root: TemplateNode, selector: string): number => {
	const query = queryOf(selector)
	if (!query) return 0
	return countIn(fragOfRoot(root).root, query)
}

/** `matchesUnder` — pure existence; exclusivity can never flip it. */
export const probeExists = (
	nodes: readonly TemplateNode[],
	selector: string,
): boolean => {
	const query = queryOf(selector)
	if (!query) return false
	return countIn(fragOfNodes(nodes).root, query) > 0
}

/**
 * `countComposeBySource` — compose placeholders are addressed by their
 * marker attribute, which no real element carries. Same aggregation walk,
 * but the walk only ever MATCHES at `lt-compose` nodes (real elements just
 * sum their children through), so a source string can never collide with
 * raw markup.
 */
const countComposeIn = (node: P5Node, query: CompiledQuery): number => {
	if (node.nodeName === '#document-fragment')
		return elementChildren(node)
			.map(child => countComposeIn(child, query))
			.reduce((a, b) => a + b, 0)
	if (!isTag(node)) return 0
	switch (node.tagName) {
		case LT_GROUP:
			return Math.max(
				0,
				...elementChildren(node).map(arm => countComposeIn(arm, query)),
			)
		case LT_ARM:
		case LT_SUM:
			return elementChildren(node)
				.map(child => countComposeIn(child, query))
				.reduce((a, b) => a + b, 0)
		case LT_COMPOSE:
			return cssSelect.is(node, query) ? 1 : 0
		default:
			return elementChildren(node)
				.map(child => countComposeIn(child, query))
				.reduce((a, b) => a + b, 0)
	}
}

export const probeCountCompose = (
	root: TemplateNode,
	source: string,
): number => {
	const query = queryOf(`[${SOURCE_ATTR}="${escapeAttr(source)}"]`)
	if (!query) return 0
	return countComposeIn(fragOfRoot(root).root, query)
}

/**
 * `allComposeNodes` — the IR compose nodes in document order, compose-site
 * children not entered (composition is a boundary), every `@try` arm
 * entered per the `@pending` policy. The probe returns them by mapping the
 * serialized placeholders back through document order, which is what makes
 * `composeNodesBySource`'s identity answers exact.
 */
export const probeComposeNodes = (root: TemplateNode): ComposeNode[] => {
	const { root: fragRoot, composeByEl } = fragOfRoot(root)
	return cssSelect
		.selectAll(`[${SOURCE_ATTR}]`, elementChildren(fragRoot), { adapter })
		.map(el => composeByEl.get(el) as ComposeNode)
}
