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
 * The serialization encodes the branch-exclusivity arithmetic in an
 * ATTRIBUTE on every element, not in wrapper elements (LT-382, ADR 0045
 * rider). Each element carries `data-lt-probe-arm`, the path of the
 * mutually exclusive arms it sits in (`<group>:<arm>` segments joined by
 * `/`, outermost first; absent at top level). An `@if`, an `@switch` and a
 * `@try` without `@pending` open a group; a `@try` WITH `@pending` opens
 * none — its arms coexist and sum, as the DOM does (LT-230's recorded
 * `@pending` policy). A count aggregates the matched elements' paths: sum
 * within an arm, MAX over the arms of a group. Wrapper elements were the
 * first design (LT-379) and HTML tree correction defeated them: parse5
 * foster-parents an unknown element out of table context and drops it
 * inside `<select>`, so the arms lost their group and summed. An attribute
 * travels with its element through every tree-correction move, so the
 * arithmetic survives whatever the browser builds. An element the parser
 * implies carries no path of its own and takes its nearest ancestor's (an
 * implied `<tbody>` exists exactly when its `<table>` does); one implied
 * outside any annotated ancestor (the trailing `<p>` of an invalid
 * `<p><div>`) counts at top level.
 *
 * Compose sites never enter the parse: a compose site has no DOM existence
 * until render, so it contributes 0 to raw-element counts, and its
 * source-keyed count runs the same path aggregation over the arm paths the
 * serializer recorded for it — matched by plain string equality, no
 * selector escaping involved.
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
 * of `<template>` elements. An authored `<template>` is LTC061 (LT-383),
 * raised in lowering on both surfaces, so a component carrying one never
 * compiles; the analysis still runs to collect further diagnostics, so the
 * materializer serializes the template's CONTENT in place (no `<template>`
 * element for css-select to skip) rather than throw.
 *
 * Pure functions only; no analysis state beyond the fragment caches.
 */

import * as cssSelect from 'css-select'
import { parseFragment } from 'parse5'
import type { TemplateNode } from '../ir'
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

/** The probe-owned attribute carrying an element's exclusive-arm path. */
const ARM_ATTR = 'data-lt-probe-arm'

const escapeAttr = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')

type Frag = {
	root: P5Node
	/** Every compose site, document order, with its exclusive-arm path. */
	composes: Array<{ node: ComposeNode; path: string }>
}

type Serializer = {
	out: string[]
	composes: Array<{ node: ComposeNode; path: string }>
	/** Next group id; ids are unique per serialization. */
	nextGroup: number
	/**
	 * Serialize each compose site's content in place: the content is the
	 * composing component's markup, rendered into the child's Children
	 * Region (ADR 0048 s1).
	 */
	regions: boolean
}

const armPath = (path: string, group: number, arm: number): string =>
	`${path ? `${path}/` : ''}${group}:${arm}`

/**
 * Materialize `nodes` into an HTML fragment string. Static attrs only —
 * a synthesized/authored selector the proof counts is static, and a
 * dynamic attribute never matches one. `path` is the exclusive-arm path of
 * the enclosing position; see the module doc.
 */
const serializeNodes = (
	nodes: readonly TemplateNode[],
	path: string,
	ser: Serializer,
): void => {
	const { out } = ser
	const exclusive = (arms: ReadonlyArray<readonly TemplateNode[]>) => {
		const group = ser.nextGroup++
		arms.forEach((arm, index) => {
			serializeNodes(arm, armPath(path, group, index), ser)
		})
	}
	for (const node of nodes) {
		switch (node.kind) {
			case 'element': {
				// An authored <template> is LTC061 (the compile fails); its
				// content is serialized in place so the analysis that still
				// runs answers from a tree css-select fully traverses.
				if (node.tag === 'template') {
					serializeNodes(node.children, path, ser)
					break
				}
				const attrs: string[] = []
				// The probe owns its arm attribute; an authored one would
				// corrupt the path arithmetic.
				for (const attr of node.attrs)
					if (attr.kind === 'static' && attr.name !== ARM_ATTR)
						attrs.push(
							attr.value === null
								? attr.name
								: `${attr.name}="${escapeAttr(attr.value)}"`,
						)
				if (path) attrs.push(`${ARM_ATTR}="${path}"`)
				out.push(`<${node.tag}${attrs.length ? ' ' : ''}${attrs.join(' ')}>`)
				// A browser reparents a void tag's children to following
				// siblings; the probe matches browser reality either way.
				serializeNodes(node.children, path, ser)
				if (!VOID_TAGS.has(node.tag)) out.push(`</${node.tag}>`)
				break
			}
			case 'compose':
				// No DOM existence until render: recorded, never emitted. Its
				// content is, in the region probe, at the site's position — the
				// child's own markup around it is the registry's to account.
				ser.composes.push({ node, path })
				if (ser.regions) serializeNodes(node.children, path, ser)
				break
			case 'conditional':
				// One arm renders, in either mode: a reactive conditional's
				// other arms are inert template content (ADR 0037).
				exclusive(node.arms.map(arm => arm.children))
				break
			case 'try':
				// One arm renders: body XOR catch, and an async boundary's
				// other arms are inert template content (ADR 0037 s4).
				exclusive([
					node.children,
					node.catchChildren,
					...(node.pendingChildren ? [node.pendingChildren] : []),
				])
				break
			default:
				// text, expr, client-stmt — no element, nothing to match.
				break
		}
	}
}

const materialize = (nodes: readonly TemplateNode[], regions = false): Frag => {
	const ser: Serializer = { out: [], composes: [], nextGroup: 0, regions }
	serializeNodes(nodes, '', ser)
	return {
		root: parseFragment(ser.out.join('')) as unknown as P5Node,
		composes: ser.composes,
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
		frag = materialize([root])
		fragByNode.set(root, frag)
	}
	return frag
}

const fragWithRegions = new WeakMap<TemplateNode, Frag>()

const fragOfRootWithRegions = (root: TemplateNode): Frag => {
	let frag = fragWithRegions.get(root)
	if (!frag) {
		frag = materialize([root], true)
		fragWithRegions.set(root, frag)
	}
	return frag
}

const fragOfNodes = (nodes: readonly TemplateNode[]): Frag => {
	let frag = fragByArray.get(nodes)
	if (!frag) {
		frag = materialize(nodes)
		fragByArray.set(nodes, frag)
	}
	return frag
}

/* === The one aggregation === */

/** An arm-path trie node: direct hits, plus each group's arms. */
type ArmTrie = { hits: number; groups: Map<string, Map<string, ArmTrie>> }

const trieNode = (): ArmTrie => ({ hits: 0, groups: new Map() })

/**
 * Aggregate hit paths into a count: sum within an arm, max over the arms of
 * a group — the exclusivity arithmetic, independent of where tree
 * correction put each element.
 */
const aggregate = (paths: readonly string[]): number => {
	const root = trieNode()
	for (const path of paths) {
		let node = root
		if (path)
			for (const segment of path.split('/')) {
				const [group, arm] = segment.split(':') as [string, string]
				let arms = node.groups.get(group)
				if (!arms) {
					arms = new Map()
					node.groups.set(group, arms)
				}
				let next = arms.get(arm)
				if (!next) {
					next = trieNode()
					arms.set(arm, next)
				}
				node = next
			}
		node.hits++
	}
	const value = (node: ArmTrie): number => {
		let total = node.hits
		for (const arms of node.groups.values())
			total += Math.max(0, ...[...arms.values()].map(value))
		return total
	}
	return value(root)
}

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

/**
 * The arm paths of every element in `frag` the query matches. An element
 * without its own path — one the parser implied, like the `<tbody>` of a
 * `<table>` of bare rows — takes its nearest ancestor's: it exists exactly
 * when that ancestor does.
 */
const matchedPaths = (frag: Frag, query: CompiledQuery): string[] => {
	const paths: string[] = []
	const visit = (node: P5Node, inherited: string): void => {
		for (const child of elementChildren(node)) {
			const path = adapter.getAttributeValue(child, ARM_ATTR) ?? inherited
			if (cssSelect.is(child, query)) paths.push(path)
			visit(child, path)
		}
	}
	visit(frag.root, '')
	return paths
}

/* === Exported Functions === */

/** `countForSelector` over the materialized probe (`analysis/selectors.ts`). */
export const probeCount = (root: TemplateNode, selector: string): number => {
	const query = queryOf(selector)
	if (!query) return 0
	return aggregate(matchedPaths(fragOfRoot(root), query))
}

/**
 * `probeCount` over the probe that also materializes every compose site's
 * content — the count for an element inside a Children Region, whose query
 * re-includes the composing component's regions (ADR 0048 s1).
 */
export const probeCountWithRegions = (
	root: TemplateNode,
	selector: string,
): number => {
	const query = queryOf(selector)
	if (!query) return 0
	return aggregate(matchedPaths(fragOfRootWithRegions(root), query))
}

/** `matchesUnder` — pure existence; exclusivity can never flip it. */
export const probeExists = (
	nodes: readonly TemplateNode[],
	selector: string,
): boolean => {
	const query = queryOf(selector)
	if (!query) return false
	return matchedPaths(fragOfNodes(nodes), query).length > 0
}

/**
 * `countComposeBySource` — the same path aggregation over the compose
 * sites whose source equals `source` (plain string equality: a compose
 * site is never a parsed element, so no selector escaping is involved and
 * a source can never collide with raw markup).
 */
export const probeCountCompose = (root: TemplateNode, source: string): number =>
	aggregate(
		fragOfRoot(root)
			.composes.filter(entry => entry.node.source === source)
			.map(entry => entry.path),
	)

/**
 * `allComposeNodes` — the IR compose nodes in document order, compose-site
 * children not entered (composition is a boundary), every `@try` arm
 * entered per the `@pending` policy — the serializer's own record, so
 * `composeNodesBySource`'s identity answers are exact.
 */
export const probeComposeNodes = (root: TemplateNode): ComposeNode[] =>
	fragOfRoot(root).composes.map(entry => entry.node)
