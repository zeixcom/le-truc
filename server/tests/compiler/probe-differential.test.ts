/**
 * LT-379 — the permanent differential pin for the materialized-probe
 * selector engine ([ADR
 * 0045](../../../adr/0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md)).
 * Production answers (`analysis/selectors.ts`, probe-backed since LT-379)
 * are compared against the hand cascades the probe replaced, embedded below
 * as the reference implementation: they are the gold standard the LT-245
 * spike proved the probe against, and any future engine change that shifts
 * an answer fails here loudly.
 *
 * Run over (1) the whole corpus — both surfaces — and (2) synthetic
 * components pinning the constructs the corpus never exercises: `@switch`
 * arms, `@try` with and without `@pending` (the max-vs-sum crux), nested
 * exclusivity, compose sites inside arms, void elements.
 *
 * LT-517: the synthetic registry handed to `composedShapesFor` is keyed by
 * the path compose nodes carry — the filename each component was compiled
 * with, the same repo-relative key `compileCorpus` registers entries under.
 * (It was keyed by the source TEXT until LT-517, so every lookup missed and
 * the composed leg agreed trivially since LT-379.) The corpus leg guards
 * non-vacuity: at least one compose lookup must hit a registered entry with
 * a known tag.
 *
 * Compared, per component:
 * - `resolveSelector` / `selectorFor` / `resolveExclusiveSelectorIn` for
 *   every element (incl. loop-output scoping via `resolveSelectorIn`),
 * - `countForSelector` for every synthesized selector candidate,
 * - `matchesUnder` for every control-flow arm × candidate,
 * - `countComposeBySource` / `allComposeNodes` / `composeNodesBySource`
 *   (compose nodes compared by identity).
 *
 * The ONE designed divergence class — HTML5 tree correction — is pinned
 * separately at the bottom (the `<p><div>` reparse, and since LT-382 the
 * `<tbody>` a `<table>` of bare `<tr>` rows implies): the probe is browser-faithful (ADR 0045
 * Decision 2), so content-model-violating nesting counts what the browser
 * builds, not what the authored nesting says. The reference walks the IR
 * and believes the authored nesting. Valid authoring diverges only by an
 * element the parser implies, which the browser's DOM really holds.
 */
import { expect, test } from 'bun:test'
import type {
	IfNode,
	SwitchNode,
	TryNode,
} from '../../compiler/analysis/selectors'
import {
	allComposeNodes,
	type ComposeNode,
	childrenRegionOfComponent,
	composedShapesFor,
	composeNodesBySource,
	countComposeBySource,
	countForSelector,
	type ElementNode,
	isElement,
	matchesUnder,
	refOf,
	renderedShapesOf,
	resolveExclusiveSelectorIn,
	resolveSelector,
	resolveSelectorIn,
	selectorFor,
	staticAttrs,
} from '../../compiler/analysis/selectors'
import type {
	ComponentIR,
	RenderedShape,
	TemplateNode,
} from '../../compiler/ir'
import type { InternalRegistryEntry } from '../../compiler/registry'
import {
	elseOf,
	isIf,
	isSwitch,
	someNode,
	thenOf,
	walkTemplate,
} from '../../compiler/walk'
import { compileCorpusSource, loadCorpus } from './corpus-fixture'

/* === The reference: the hand cascades as they stood before LT-379 === */

/** The one-clause synthesized grammar, as the hand matcher parsed it. */
const REF_GRAMMAR =
	/^([a-z][a-z0-9-]*)?(?:\[([^\]="]+)="([^"]*)"\]|\.([A-Za-z_-][\w-]*)|#([A-Za-z_-][\w-]*))?$/

const refMatchesSelector = (
	candidate: ElementNode,
	selector: string,
): boolean => {
	const match = selector.match(REF_GRAMMAR)
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

const refCountForSelector = (node: TemplateNode, selector: string): number => {
	if (node.kind === 'conditional')
		return Math.max(
			...node.arms.map(arm =>
				arm.children.reduce(
					(sum, child) => sum + refCountForSelector(child, selector),
					0,
				),
			),
		)
	if (node.kind === 'try')
		// One arm in the document at a time (ADR 0037 s4, LT-276): an async
		// boundary's other arms are template content.
		return Math.max(
			...[
				node.children,
				node.catchChildren,
				...(node.pendingChildren ? [node.pendingChildren] : []),
			].map(arm =>
				arm.reduce((sum, c) => sum + refCountForSelector(c, selector), 0),
			),
		)
	if (!isElement(node)) return 0
	let count = refMatchesSelector(node, selector) ? 1 : 0
	for (const child of node.children)
		count += refCountForSelector(child, selector)
	return count
}

/**
 * The region probe's hand cascade (LT-517, mirror of
 * `probeCountWithRegions`): `refCountForSelector` with every compose site's
 * content entered — the content is the composing component's own markup
 * (ADR 0048 s1), materialized in place at the site. The count for an
 * element inside a Children Region, whose emitted query re-includes the
 * owner's regions.
 */
const refCountWithRegions = (node: TemplateNode, selector: string): number => {
	if (node.kind === 'conditional')
		return Math.max(
			...node.arms.map(arm =>
				arm.children.reduce(
					(sum, child) => sum + refCountWithRegions(child, selector),
					0,
				),
			),
		)
	if (node.kind === 'try')
		return Math.max(
			...[
				node.children,
				node.catchChildren,
				...(node.pendingChildren ? [node.pendingChildren] : []),
			].map(arm =>
				arm.reduce((sum, c) => sum + refCountWithRegions(c, selector), 0),
			),
		)
	if (node.kind === 'compose')
		return node.children.reduce(
			(sum, child) => sum + refCountWithRegions(child, selector),
			0,
		)
	if (!isElement(node)) return 0
	let count = refMatchesSelector(node, selector) ? 1 : 0
	for (const child of node.children)
		count += refCountWithRegions(child, selector)
	return count
}

const refCountComposeBySource = (
	node: TemplateNode,
	source: string,
): number => {
	if (node.kind === 'conditional')
		return Math.max(
			...node.arms.map(arm =>
				arm.children.reduce(
					(sum, child) => sum + refCountComposeBySource(child, source),
					0,
				),
			),
		)
	if (node.kind === 'try') {
		const count = (arm: readonly TemplateNode[]): number =>
			arm.reduce((sum, c) => sum + refCountComposeBySource(c, source), 0)
		return Math.max(
			count(node.children),
			count(node.catchChildren),
			count(node.pendingChildren ?? []),
		)
	}
	if (node.kind === 'compose') return node.source === source ? 1 : 0
	if (!isElement(node)) return 0
	let count = 0
	for (const child of node.children)
		count += refCountComposeBySource(child, source)
	return count
}

const refAllComposeNodes = (root: TemplateNode): ComposeNode[] => {
	const out: ComposeNode[] = []
	walkTemplate(
		root,
		node => {
			if (node.kind === 'compose') out.push(node)
		},
		{ intoCompose: false },
	)
	return out
}

const refMatchesUnder = (
	nodes: readonly TemplateNode[],
	selector: string,
): boolean =>
	nodes.some(root =>
		someNode(
			root,
			node => isElement(node) && refMatchesSelector(node, selector),
			{ intoCompose: false },
		),
	)

const refMayMatchShape = (shape: RenderedShape, selector: string): boolean => {
	if (shape.kind !== 'element') return true
	const match = selector.match(REF_GRAMMAR)
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

const PLAIN_SELECTOR_TOKEN = /^[A-Za-z_-][\w-]*$/

const refBuildSelector = (
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
 * Precision of a synthesized base among exclusion-decorated candidates
 * (LT-520, the mirror of `PRECISION`): a `role` clause keeps its first
 * place as the element's semantic contract, an `id` names one element
 * outright, a `class`/`data-*` clause is the author's addressing hook, and
 * the bare tag — with `type` and `aria-*`, which keep their candidate-order
 * places — narrows nothing.
 */
const REF_PRECISION = { role: 3, id: 2, hook: 1, bare: 0 } as const

type RefRankedBase = { base: string; rank: number }

const refDiscriminatorCandidates = (element: ElementNode): RefRankedBase[] => {
	const attrs = staticAttrs(element)
	const prefix = element.tag === 'div' ? '' : element.tag
	const exact = (name: string, value: string): string =>
		`${prefix}[${name}="${value}"]`
	const candidates = new Map<string, number>()
	const type = attrs.get('type')
	if (typeof type === 'string')
		candidates.set(exact('type', type), REF_PRECISION.bare)
	const className = attrs.get('class')
	if (typeof className === 'string') {
		const tokens = className.split(/\s+/).filter(Boolean)
		for (const token of tokens)
			candidates.set(
				PLAIN_SELECTOR_TOKEN.test(token)
					? `${prefix}.${token}`
					: exact('class', className),
				REF_PRECISION.hook,
			)
	}
	const id = attrs.get('id')
	if (typeof id === 'string')
		candidates.set(
			PLAIN_SELECTOR_TOKEN.test(id) ? `${prefix}#${id}` : exact('id', id),
			REF_PRECISION.id,
		)
	for (const [name, value] of attrs)
		if (name.startsWith('data-') && typeof value === 'string')
			candidates.set(exact(name, value), REF_PRECISION.hook)
	for (const [name, value] of attrs)
		if (
			name.startsWith('aria-') &&
			typeof value === 'string' &&
			!/["\\]/.test(value)
		)
			candidates.set(exact(name, value), REF_PRECISION.bare)
	return [...candidates].map(([base, rank]) => ({ base, rank }))
}

const refAuthoredSelectorOf = (element: ElementNode): string | null => {
	const selector = refOf(element)?.selector?.trim()
	return selector && REF_GRAMMAR.test(selector) ? selector : null
}

/**
 * The compose site whose content holds `target` under `tree`, or null —
 * the mirror of `enclosingComposeOf` (selectors.ts).
 */
const refEnclosingComposeOf = (
	tree: TemplateNode,
	target: TemplateNode,
): ComposeNode | null => {
	let found: ComposeNode | null = null
	walkTemplate(tree, node => {
		if (found || node.kind !== 'compose') return
		if (node.children.some(child => someNode(child, n => n === target)))
			found = node
	})
	return found
}

/**
 * The region-form exclusion (LT-517, mirror of `excludeUnlessOwned`):
 * `base` narrowed by `:not(<tag> *)` per clashing composed child, except
 * inside a region `owner` owns — where only the terms rebased on the
 * region still exclude.
 */
const refExcludeUnlessOwned = (
	owner: string,
	tags: readonly string[],
): string => {
	const region = `[data-children="${owner}"]`
	const outer = tags.map(tag => `${tag} *`).join(', ')
	const inner = tags.map(tag => `${region} ${tag} *`).join(', ')
	return `:not(:is(${outer}):not(:is(${region} *):not(:is(${inner}))))`
}

const refSelectorCandidates = (
	tree: TemplateNode,
	element: ElementNode,
	composed: ReadonlyMap<string, ComposedMarkupRef> | undefined,
): {
	list: Array<{ base: string; emit: string }>
	excluded: Array<{ base: string; emit: string; rank: number }>
} => {
	const role = refBuildSelector(element, 'role')
	const bases: RefRankedBase[] = [
		...(role !== null ? [{ base: role, rank: REF_PRECISION.role }] : []),
		{ base: element.tag, rank: REF_PRECISION.bare },
		...refDiscriminatorCandidates(element),
	]
	const authored = refAuthoredSelectorOf(element)
	const region = refEnclosingComposeOf(tree, element)
	if (!composed) {
		const synthesized = bases.map(({ base }) => ({ base, emit: base }))
		return {
			list: authored
				? [{ base: authored, emit: authored }, ...synthesized]
				: synthesized,
			excluded: [],
		}
	}
	const sites = refAllComposeNodes(tree)
	const children = sites.map(
		node =>
			composed.get(node.source) ?? {
				tag: null,
				shapes: [] as const,
				region: null,
				owner: '',
			},
	)
	const owner = region ? composed.get(region.source) : undefined
	/**
	 * An element inside a Children Region is reached through the
	 * re-include clause, which admits everything in every region this
	 * component owns: the content it passes and whatever a child renders
	 * there besides it. `base` is safe only when no such markup could match
	 * it, and only when the element's own compose site marks the region at
	 * all. (Mirror of `composedEmitter`'s `regionSafe`.)
	 */
	const regionSafe = (base: string, site: ComposeNode): boolean =>
		sites.every((node, index) => {
			if (node.children.length === 0) return true
			const markup = children[index] as ComposedMarkupRef
			if (markup.region === null) return node !== site
			return !markup.region.some(shape => refMayMatchShape(shape, base))
		})
	const emitFor = (base: string): { clean: boolean; emit: string } | null => {
		if (owner && !regionSafe(base, region as ComposeNode)) return null
		const clashing = children.filter(
			child =>
				child.tag === null ||
				child.shapes.some(
					// The `children` shape is the passed content, not the child's
					// markup: a clash only for a target in the template proper
					// (LT-512, owner ruling 2026-10-09) — for a region-content
					// target the count is the region probe and the region-form
					// exclusion's re-include re-admits it.
					shape =>
						(shape.kind !== 'children' || !owner) &&
						refMayMatchShape(shape, base),
				),
		)
		if (clashing.length === 0) return { clean: true, emit: base }
		if (clashing.some(child => child.tag === null)) return null
		const tags = [...new Set(clashing.map(child => child.tag as string))]
		if (!owner)
			return {
				clean: false,
				emit: `${base}:not(${tags.map(tag => `${tag} *`).join(', ')})`,
			}
		return {
			clean: false,
			emit: `${base}${refExcludeUnlessOwned(owner.owner, tags)}`,
		}
	}
	const clean: Array<{ base: string; emit: string }> = []
	const excluded: Array<{ base: string; emit: string; rank: number }> = []
	for (const { base, rank } of bases) {
		const resolved = emitFor(base)
		if (!resolved) continue
		if (resolved.clean) clean.push({ base, emit: resolved.emit })
		else excluded.push({ base, emit: resolved.emit, rank })
	}
	const own = authored ? emitFor(authored) : null
	return {
		list: [
			...(authored && own ? [{ base: authored, emit: own.emit }] : []),
			...clean.map(({ base, emit }) => ({ base, emit })),
		],
		excluded,
	}
}

type ComposedMarkupRef = {
	tag: string | null
	shapes: readonly RenderedShape[]
	/** What the child renders in the parent's Children Region besides the content. */
	region: readonly RenderedShape[] | null
	/** The composing parent's tag: the owner its regions are marked with. */
	owner: string
}

/** Mirror of `byPrecision`: most precise decorated base first, ties stable. */
const refByPrecision = <T extends { rank: number }>(
	excluded: readonly T[],
): T[] => [...excluded].sort((a, b) => b.rank - a.rank)

const refResolveSelectorIn = (
	tree: ElementNode,
	element: ElementNode,
	composed?: ReadonlyMap<string, ComposedMarkupRef>,
): { selector: string; unique: boolean } => {
	const { list, excluded } = refSelectorCandidates(tree, element, composed)
	// A region-content target's count is the region probe: compose-site
	// content is materialized at the site (LT-517, mirror of
	// `selectorCandidates`' `probeCountWithRegions` branch).
	const countOf = refEnclosingComposeOf(tree, element)
		? refCountWithRegions
		: refCountForSelector
	for (const { base, emit } of list) {
		if (countOf(tree, base) === 1) return { selector: emit, unique: true }
	}
	for (const { base, emit } of refByPrecision(excluded)) {
		if (countOf(tree, base) === 1) return { selector: emit, unique: true }
	}
	return {
		selector: list[0]?.emit ?? excluded[0]?.emit ?? element.tag,
		unique: false,
	}
}

const refResolveExclusiveSelectorIn = (
	tree: ElementNode,
	element: ElementNode,
	clash: readonly TemplateNode[],
	composed?: ReadonlyMap<string, ComposedMarkupRef>,
): { selector: string; unique: boolean } => {
	const { list, excluded } = refSelectorCandidates(tree, element, composed)
	const countOf = refEnclosingComposeOf(tree, element)
		? refCountWithRegions
		: refCountForSelector
	for (const { base, emit } of list) {
		if (countOf(tree, base) !== 1) continue
		if (refMatchesUnder(clash, base)) continue
		return { selector: emit, unique: true }
	}
	for (const { base, emit } of refByPrecision(excluded)) {
		if (countOf(tree, base) !== 1) continue
		if (refMatchesUnder(clash, base)) continue
		return { selector: emit, unique: true }
	}
	return {
		selector: list[0]?.emit ?? excluded[0]?.emit ?? element.tag,
		unique: false,
	}
}

const refEnclosingIfOf = (
	root: TemplateNode,
	target: ElementNode,
): IfNode | null => {
	const walk = (node: TemplateNode): IfNode | null => {
		if (isIf(node) && node.mode === 'server') {
			const branches = [...thenOf(node), ...elseOf(node)]
			if (branches.includes(target)) return node
			for (const child of branches) {
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
	return walk(root)
}

const refSelectorFor = (
	root: ElementNode,
	el: ElementNode,
	composed?: ReadonlyMap<string, ComposedMarkupRef>,
): { selector: string; unique: boolean } => {
	const enclosing = refEnclosingIfOf(root, el)
	if (!enclosing) return refResolveSelectorIn(root, el, composed)
	const roots = [...thenOf(enclosing), ...elseOf(enclosing)].filter(isElement)
	const clauses: string[] = []
	for (const rootEl of roots) {
		const self = refResolveSelectorIn(root, rootEl, composed)
		if (!self.unique) return { selector: self.selector, unique: false }
		if (!clauses.includes(self.selector)) clauses.push(self.selector)
	}
	return { selector: clauses.join(', '), unique: true }
}

/* === Shared runner === */

let composeCounter = 0
const globalComposeIds = new Map<TemplateNode, string>()
const composeId = (node: TemplateNode): string => {
	if (!globalComposeIds.has(node))
		globalComposeIds.set(node, `c${composeCounter++}`)
	return globalComposeIds.get(node) as string
}
const ids = (nodes: readonly ComposeNode[]) =>
	nodes.map(n => composeId(n)).join(',')

const pos = (node: TemplateNode) =>
	(node.node as { start?: number })?.start ?? -1
const describeEl = (el: ElementNode): string => `${el.tag}@${pos(el)}`

const mismatches: string[] = []

const compareResolved = (
	tag: string,
	label: string,
	ref: { selector: string; unique: boolean },
	prod: { selector: string; unique: boolean },
) => {
	if (ref.selector !== prod.selector || ref.unique !== prod.unique)
		mismatches.push(
			`${tag}: ${label} reference=${JSON.stringify(ref)} production=${JSON.stringify(prod)}`,
		)
}

/** One compiled component, with the filename the harness compiled it by. */
type Compiled = { path: string; component: ComponentIR }

const runDifferential = (compiled: readonly Compiled[]): void => {
	// LT-517: keyed by the path compose nodes carry — the filename each
	// component was compiled with, resolved exactly the way
	// `scripts/build-corpus.ts` (via `compileCorpus`) resolves compose
	// sources and registers entries. Keyed by the source TEXT until
	// LT-517, so every `composedShapesFor` lookup missed on both sides and
	// each child resolved as unknown markup.
	const registry: ReadonlyMap<string, InternalRegistryEntry> = new Map(
		compiled.map(({ path, component: c }) => {
			const region = childrenRegionOfComponent(c)
			return [
				path,
				{
					tag: c.tag,
					name: c.name,
					source: path,
					serverModule: '',
					clientModule: '',
					css: '',
					propsType: null,
					exposedProps: {},
					renderedShapes: renderedShapesOf(c),
					...(region ? { childrenRegion: region } : {}),
				} as unknown as InternalRegistryEntry,
			]
		}),
	)
	for (const { component } of compiled)
		(component as { composedShapes?: unknown }).composedShapes =
			composedShapesFor(component.root, registry)

	let elementCount = 0
	let controlCount = 0
	let loopCount = 0
	let composeCount = 0
	let selectorQueries = 0

	for (const { component } of compiled) {
		const { root } = component
		const shapes = component.composedShapes
		const tag = component.tag

		const elements: ElementNode[] = []
		const ifs: IfNode[] = []
		const switches: SwitchNode[] = []
		const trys: TryNode[] = []
		walkTemplate(root, node => {
			if (node.kind === 'element') elements.push(node)
			else if (isIf(node)) ifs.push(node)
			else if (isSwitch(node)) switches.push(node)
			else if (node.kind === 'try') trys.push(node)
		})
		elementCount += elements.length
		controlCount += ifs.length + switches.length + trys.length

		// The @for outputs must sit in the root tree for the probe to see them.
		for (const [, forIR] of component.fors) {
			loopCount++
			let inTree = false
			walkTemplate(root, n => {
				if (n === forIR.output) inTree = true
			})
			if (!inTree)
				mismatches.push(`${tag}: @for output element NOT in root tree`)
			// Loop-scoped resolution (loops.ts's resolveSelectorScoped).
			const loopEls: ElementNode[] = []
			walkTemplate(forIR.output, n => {
				if (n.kind === 'element') loopEls.push(n)
			})
			for (const el of loopEls)
				compareResolved(
					tag,
					`loop-scope ${describeEl(el)}`,
					refResolveSelectorIn(forIR.output, el, shapes),
					resolveSelectorIn(forIR.output, el, shapes),
				)
		}

		// All candidate selectors ever synthesized, per element.
		const selectors = new Set<string>()
		for (const el of elements)
			for (const s of candidatesOf(el)) selectors.add(s)

		// 1. countForSelector, per selector.
		for (const sel of selectors) {
			selectorQueries++
			const refC = refCountForSelector(root, sel)
			const prodC = countForSelector(root, sel)
			if (refC !== prodC)
				mismatches.push(
					`${tag}: countForSelector(${sel}) reference=${refC} production=${prodC}`,
				)
		}

		// 2. matchesUnder, per arm of every control node × every selector.
		const arms: Array<[string, readonly TemplateNode[]]> = []
		for (const node of ifs)
			arms.push(
				[`if.then@${pos(node)}`, thenOf(node)],
				[`if.alt@${pos(node)}`, elseOf(node)],
			)
		for (const node of switches)
			node.arms.forEach((arm, i) =>
				arms.push([`switch[${i}]@${pos(node)}`, arm.children]),
			)
		for (const node of trys) {
			arms.push([`try.body@${pos(node)}`, node.children])
			arms.push([`try.catch@${pos(node)}`, node.catchChildren])
			if (node.pendingChildren)
				arms.push([`try.pending@${pos(node)}`, node.pendingChildren])
		}
		for (const [label, armNodes] of arms)
			for (const sel of selectors) {
				const refM = refMatchesUnder(armNodes, sel)
				const prodM = matchesUnder(armNodes, sel)
				if (refM !== prodM)
					mismatches.push(
						`${tag}: matchesUnder(${label}, ${sel}) reference=${refM} production=${prodM}`,
					)
			}

		// 3. resolveSelector + selectorFor, per element.
		for (const el of elements) {
			const where = describeEl(el)
			compareResolved(
				tag,
				`resolveSelector ${where}`,
				refResolveSelectorIn(root, el, shapes),
				resolveSelector(component, el),
			)
			compareResolved(
				tag,
				`selectorFor ${where}`,
				refSelectorFor(root, el, shapes),
				selectorFor(component, el),
			)
		}

		// 4. resolveExclusiveSelectorIn, per control-node branch root.
		for (const node of ifs)
			for (const [body, other] of [
				[thenOf(node), elseOf(node)],
				[elseOf(node), thenOf(node)],
			] as Array<[readonly TemplateNode[], readonly TemplateNode[]]>)
				for (const el of body.filter(n => n.kind === 'element'))
					compareResolved(
						tag,
						`exclusive if ${describeEl(el as ElementNode)}`,
						refResolveExclusiveSelectorIn(
							root,
							el as ElementNode,
							other,
							shapes,
						),
						resolveExclusiveSelectorIn(root, el as ElementNode, other, shapes),
					)
		for (const node of switches)
			for (let i = 0; i < node.arms.length; i++) {
				const arm = node.arms[i]
				if (!arm) continue
				const other = node.arms
					.filter((_, j) => j !== i)
					.flatMap(a => a.children)
				for (const el of arm.children.filter(n => n.kind === 'element'))
					compareResolved(
						tag,
						`exclusive switch[${i}] ${describeEl(el as ElementNode)}`,
						refResolveExclusiveSelectorIn(
							root,
							el as ElementNode,
							other,
							shapes,
						),
						resolveExclusiveSelectorIn(root, el as ElementNode, other, shapes),
					)
			}

		// 5. compose cascades.
		const composeNodes = allComposeNodes(root)
		composeCount += composeNodes.length
		const sources = [...new Set(composeNodes.map(n => n.source))]
		if (ids(refAllComposeNodes(root)) !== ids(allComposeNodes(root)))
			mismatches.push(
				`${tag}: allComposeNodes reference=[${ids(refAllComposeNodes(root))}] production=[${ids(allComposeNodes(root))}]`,
			)
		for (const source of sources) {
			const refC = refCountComposeBySource(root, source)
			const prodC = countComposeBySource(root, source)
			if (refC !== prodC)
				mismatches.push(
					`${tag}: countComposeBySource(${source}) reference=${refC} production=${prodC}`,
				)
			const refN = ids(
				refAllComposeNodes(root).filter(n => n.source === source),
			)
			const prodN = ids(composeNodesBySource(root, source))
			if (refN !== prodN)
				mismatches.push(
					`${tag}: composeNodesBySource(${source}) reference=[${refN}] production=[${prodN}]`,
				)
		}
	}

	console.log(
		`[LT-379 pin] components=${compiled.length} elements=${elementCount} ` +
			`control-nodes=${controlCount} loops=${loopCount} compose-sites=${composeCount} ` +
			`selector-queries=${selectorQueries} mismatches=${mismatches.length}`,
	)
}

/** role/bare/discriminator candidates, mirroring `selectorCandidates`' bases. */
const candidatesOf = (el: ElementNode): string[] => {
	const attrs = staticAttrs(el)
	const out = new Set<string>()
	const prefix = el.tag === 'div' ? '' : el.tag
	const exact = (name: string, value: string) => `${prefix}[${name}="${value}"]`
	const role = attrs.get('role')
	if (role !== undefined && role !== null) out.add(buildRole(el))
	out.add(el.tag)
	const type = attrs.get('type')
	if (typeof type === 'string') out.add(exact('type', type))
	const className = attrs.get('class')
	if (typeof className === 'string')
		for (const token of className.split(/\s+/).filter(Boolean))
			out.add(
				PLAIN_SELECTOR_TOKEN.test(token)
					? `${prefix}.${token}`
					: exact('class', className),
			)
	const id = attrs.get('id')
	if (typeof id === 'string')
		out.add(PLAIN_SELECTOR_TOKEN.test(id) ? `${prefix}#${id}` : exact('id', id))
	for (const [name, value] of attrs) {
		if (name.startsWith('data-') && typeof value === 'string')
			out.add(exact(name, value))
		if (
			name.startsWith('aria-') &&
			typeof value === 'string' &&
			!/["\\]/.test(value)
		)
			out.add(exact(name, value))
	}
	return [...out]
}

const buildRole = (el: ElementNode): string => {
	const role = staticAttrs(el).get('role')
	if (role !== undefined && role !== null)
		return el.tag === 'div' ? `[role="${role}"]` : `${el.tag}[role="${role}"]`
	return el.tag
}

/* === 1. The corpus, both surfaces === */

test('differential pin: hand cascades vs the probe-backed engine over the corpus', async () => {
	const files = await loadCorpus()
	const compiled: Compiled[] = []
	for (const file of files) {
		// The repo-relative filename, the one `compileCorpus` compiles by —
		// compose sources resolve against it to exactly the registry keys.
		const { component } = compileCorpusSource(file.content, file.filename)
		if (component)
			compiled.push({
				path: file.filename,
				component: component as ComponentIR,
			})
	}
	expect(compiled.length).toBeGreaterThan(15)
	runDifferential(compiled)
	// Non-vacuity (LT-517): the composed comparison is only a pin when the
	// registry RESOLVES children — at least one compose lookup must hit a
	// registered entry with a known tag, or the leg agrees trivially on
	// unknown markup everywhere.
	expect(
		compiled.some(({ component }) =>
			[...(component.composedShapes ?? new Map()).values()].some(
				markup => markup.tag !== null,
			),
		),
	).toBeTrue()
	expect(mismatches).toEqual([])
}, 120_000)

/* === 2. Synthetic pins for constructs the corpus never exercises === */

const CHILD = `export function BasicChild({ label }: { label: string })
	@{
		expose({ value: '' })
			<basic-child>{label}
			</basic-child>
	}
import { expose } from '@zeix/le-truc'`

const SYNTHETICS: Array<[string, string]> = [
	// @switch arms (corpus authors none): same-tag roots across arms must
	// resolve through the max rule, not sum.
	[
		'examples/spike/probe-switch.tsrx',
		`export function ProbeSwitch({ mode }: { mode: string })
	@{
		expose({})
			<probe-switch>
				@switch (mode) {
					@case 'a': {
						<p>one</p>
					}
					@case 'b': {
						<p class="b">two</p>
					}
					@default: {
						<span>other</span>
					}
				}
			</probe-switch>
	}
import { expose } from '@zeix/le-truc'`,
	],
	// @try WITHOUT @pending: body XOR catch (max), same-tag roots.
	[
		'examples/spike/probe-try.tsrx',
		`export function ProbeTry({ data }: { data: string })
	@{
		expose({})
			<probe-try>
				@try {
					<p class="body">{data}</p>
				} @catch (e) {
					<p class="error">{e.message}</p>
				}
			</probe-try>
	}
import { expose } from '@zeix/le-truc'`,
	],
	// @try WITH @pending: all three arms COEXIST — the bare tag counts 3
	// (sum), while an identical @if would count 1 (max). Compose sites sit
	// in the body and catch arms only (pending arms take one root element).
	[
		'examples/spike/probe-pending.tsrx',
		`import { BasicChild } from '../child/basic-child.tsrx'
import { deriveCell, expose } from '@zeix/le-truc'

export function ProbePending({}: {})
	@{
		const data = deriveCell(async () => 'x')
		expose({})
			<probe-pending>
				@try {
					<p class="body">{data}</p>
				} @pending {
					<p class="loading">loading…</p>
				} @catch (e) {
					<p class="error">{e.message}</p>
				}
			</probe-pending>
	}`,
	],
	// Nested exclusivity: @if inside @if branches, same-tag leaves.
	[
		'examples/spike/probe-nested.tsrx',
		`export function ProbeNested({ a, b }: { a: boolean; b: boolean })
	@{
		expose({})
			<probe-nested>
				@if (a) {
					@if (b) {
						<div class="aa">x</div>
					} @else {
						<div class="ab">y</div>
					}
				} @else {
					<>
						<div class="c">z</div>
						<span>w</span>
					</>
				}
			</probe-nested>
	}
import { expose } from '@zeix/le-truc'`,
	],
	// LT-382: exclusive arms inside table and select context. HTML tree
	// correction foster-parents an unknown element out of a <table> and
	// drops it inside a <select>, which defeated LT-379's wrapper elements
	// (the arms summed). The arm path rides each element as an attribute,
	// so the max rule survives. `<li>` in a `<ul>` is the control.
	[
		'examples/spike/probe-table.tsrx',
		`import { BasicChild } from '../child/basic-child.tsrx'
import { expose } from '@zeix/le-truc'

export function ProbeTable({ a, mode, data }: { a: boolean; mode: string; data: string })
	@{
		expose({})
			<probe-table>
				<table>
					<tbody>
						@if (a) {
							<tr class="row"><td class="cell">one</td></tr>
						} @else {
							<tr class="row"><td class="cell"><BasicChild label={'x'} /></td></tr>
						}
						@switch (mode) {
							@case 'a': {
								<tr class="body-row"><td>a</td></tr>
							}
							@default: {
								<tr class="body-row"><td>b</td></tr>
							}
						}
						@try {
							<tr class="try-row"><td>{data}</td></tr>
						} @catch (e) {
							<tr class="try-row"><td>{e.message}</td></tr>
						}
					</tbody>
				</table>
				<select>
					@if (a) {
						<option class="opt">one</option>
					} @else {
						<option class="opt">two</option>
					}
				</select>
				<ul>
					@if (a) {
						<li class="item">one</li>
					} @else {
						<li class="item">two</li>
					}
				</ul>
			</probe-table>
	}`,
	],
	// LT-382: `<tr>` arms directly in a `<table>` — the parser implies a
	// `<tbody>`, so this is pinned SEPARATELY below (the implied element is
	// browser reality the IR reference cannot see).
	[
		'examples/spike/probe-table-implied.tsrx',
		`export function ProbeTableImplied({ a }: { a: boolean })
	@{
		expose({})
			<probe-table-implied>
				<table>
					@if (a) {
						<tr class="row"><td class="cell">one</td></tr>
					} @else {
						<tr class="row"><td class="cell">two</td></tr>
					}
				</table>
			</probe-table-implied>
	}
import { expose } from '@zeix/le-truc'`,
	],
	// Void elements and HTML tree correction (`<p>` auto-closing before a
	// `<div>`): pinned SEPARATELY below as the one designed divergence.
	[
		'examples/spike/probe-html.tsrx',
		`export function ProbeHtml({ text }: { text: string })
	@{
		expose({})
			<probe-html>
				<p>intro {text}</p>
				<p><div class="flow">blocks</div></p>
				<input type="text" placeholder="type here" />
				<br/>
			</probe-html>
	}
import { expose } from '@zeix/le-truc'`,
	],
	// Two same-source compose sites discriminated by static class; an
	// @if wrapping one of them exercises compose-in-branch.
	[
		'examples/spike/probe-compose.tsrx',
		`import { BasicChild } from '../child/basic-child.tsrx'
import { expose } from '@zeix/le-truc'

export function ProbeCompose({ alt }: { alt: boolean })
	@{
		expose({})
			<probe-compose>
				<BasicChild label={'a'} class="first" />
				@if (alt) {
					<BasicChild label={'b'} class="second" />
				}
			</probe-compose>
	}`,
	],
]

test('differential pin: synthetic switch/try/pending/nested/compose', () => {
	const child = compileCorpusSource(CHILD, 'examples/child/basic-child.tsrx')
	if (!child.component) throw new Error('child must compile')
	const compiled: Compiled[] = [
		{
			path: 'examples/child/basic-child.tsrx',
			component: child.component as ComponentIR,
		},
	]
	let htmlCorrected: ComponentIR | null = null
	let tableImplied: ComponentIR | null = null
	for (const [path, content] of SYNTHETICS) {
		const { component, diagnostics } = compileCorpusSource(content, path)
		if (!component)
			throw new Error(`${path} must compile: ${JSON.stringify(diagnostics)}`)
		if (path.endsWith('probe-html.tsrx')) {
			htmlCorrected = component as ComponentIR
			continue
		}
		if (path.endsWith('probe-table-implied.tsrx')) {
			tableImplied = component as ComponentIR
			continue
		}
		compiled.push({ path, component: component as ComponentIR })
	}
	runDifferential(compiled)
	expect(mismatches).toEqual([])

	// probe-html is pinned SEPARATELY, as the record of the one divergence
	// class the probe is DESIGNED to introduce (ADR 0045 Decision 2): HTML5
	// tree correction. The authored `<p><div>…</div></p>` parses in a
	// browser (and in parse5) with the div auto-closing the paragraph, and
	// the implied `</p>` end tag inserts an empty third `<p>` — so a real
	// DOM has 3, the authored IR has 2. The production engine counts what
	// the browser builds; the reference walks the IR. The corpus never
	// authors content-model-violating nesting, so this is a
	// latent-unsoundness note, not a corpus divergence.
	// LT-382: the table/select arms count by the max rule, explicitly.
	const table = compiled
		.map(entry => entry.component)
		.find(c => someNode(c.root, n => isElement(n) && n.tag === 'probe-table'))
	if (!table) throw new Error('probe-table must compile')
	for (const selector of [
		'tr.row',
		'td.cell',
		'tr.body-row',
		'tr.try-row',
		'option.opt',
		'li.item',
	])
		expect([selector, countForSelector(table.root, selector)]).toEqual([
			selector,
			1,
		])
	// The compose site in a table cell inside an arm: counted, and mapped
	// back to its IR node.
	expect(
		countComposeBySource(table.root, 'examples/child/basic-child.tsrx'),
	).toBe(1)
	expect(allComposeNodes(table.root)).toHaveLength(1)

	// The implied `<tbody>`: the arms keep the max rule (one row, one cell),
	// and the parser-implied element counts once — it exists in every arm
	// combination, and `querySelector('tbody')` finds it in the real DOM.
	if (!tableImplied) throw new Error('probe-table-implied must compile')
	expect(countForSelector(tableImplied.root, 'tr.row')).toBe(1)
	expect(countForSelector(tableImplied.root, 'td.cell')).toBe(1)
	expect(refCountForSelector(tableImplied.root, 'tbody')).toBe(0)
	expect(countForSelector(tableImplied.root, 'tbody')).toBe(1)

	if (!htmlCorrected) throw new Error('probe-html must compile')
	expect(refCountForSelector(htmlCorrected.root, 'p')).toBe(2)
	expect(countForSelector(htmlCorrected.root, 'p')).toBe(3)
})

/* === 3. Compose source strings are matched verbatim (LT-382) === */

test('a compose source with HTML-special characters counts as itself', () => {
	const compose = (source: string) =>
		({
			kind: 'compose',
			source,
			attrs: [],
			children: [],
		}) as unknown as TemplateNode
	const root = {
		kind: 'element',
		tag: 'div',
		attrs: [],
		children: [
			compose('./a&b<c>.tsrx'),
			compose('./a"q.tsrx'),
			compose('./plain.tsrx'),
		],
	} as unknown as TemplateNode
	expect(countComposeBySource(root, './a&b<c>.tsrx')).toBe(1)
	expect(countComposeBySource(root, './a"q.tsrx')).toBe(1)
	expect(countComposeBySource(root, './plain.tsrx')).toBe(1)
	expect(allComposeNodes(root)).toHaveLength(3)
})

test("a parser-implied element inherits its ancestor's arm path", () => {
	const el = (tag: string, children: unknown[] = []) => ({
		kind: 'element',
		tag,
		attrs: [],
		children,
	})
	const table = () => el('table', [el('tr', [el('td')])])
	// One <table> of bare rows per arm: each implies a <tbody>, and only one
	// arm renders at a time.
	const root = el('div', [
		{
			kind: 'conditional',
			arms: [{ children: [table()] }, { children: [table()] }],
		},
	]) as unknown as TemplateNode
	expect(countForSelector(root, 'tbody')).toBe(1)
	expect(countForSelector(root, 'tr')).toBe(1)
})
