/**
 * LT-245 SPIKE — differential harness: the hand-rolled cascades in
 * `analysis/selectors.ts` vs the materialized-probe engine
 * (`selector-probe.ts`). Not an acceptance test of production behavior —
 * the record of whether the substitution reproduces the current answers
 * exactly.
 *
 * Run over (1) the whole corpus — both surfaces — and (2) synthetic
 * components pinning the constructs the corpus never exercises: `@switch`
 * arms, `@try` with and without `@pending` (the max-vs-sum crux), nested
 * exclusivity, compose sites inside arms, void elements, and markup whose
 * HTML parse tree differs from its authored nesting (`<p>` auto-closing).
 *
 * Compared, per component:
 * - `resolveSelector` / `selectorFor` / `resolveExclusiveSelectorIn` for
 *   every element (incl. loop-output scoping via `resolveSelectorIn`),
 * - `countForSelector` for every synthesized selector candidate,
 * - `matchesUnder` for every control-flow arm × candidate,
 * - `countComposeBySource` / `allComposeNodes` / `composeNodesBySource`
 *   (compose nodes compared by identity).
 */
import { expect, test } from 'bun:test'
import type {
	IfNode,
	SwitchNode,
	TryNode,
} from '../../../compiler/analysis/selectors'
import {
	allComposeNodes,
	type ComposeNode,
	composedShapesFor,
	countComposeBySource,
	countForSelector,
	type ElementNode,
	matchesUnder,
	renderedShapesOf,
	resolveExclusiveSelectorIn,
	resolveSelector,
	resolveSelectorIn,
	selectorFor,
	staticAttrs,
} from '../../../compiler/analysis/selectors'
import type { ComponentIR, TemplateNode } from '../../../compiler/ir'
import type { RegistryEntry } from '../../../compiler/registry'
import { walkTemplate } from '../../../compiler/walk'
import { compileCorpusSource, loadCorpus } from '../corpus-fixture'
import {
	probeAllComposeNodes,
	probeComposeNodesBySource,
	probeCountComposeBySource,
	probeCountForSelector,
	probeMatchesUnder,
	probeResolveExclusiveSelectorIn,
	probeResolveSelectorIn,
	probeSelectorFor,
} from './selector-probe'

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
	oldR: { selector: string; unique: boolean },
	newR: { selector: string; unique: boolean },
) => {
	if (oldR.selector !== newR.selector || oldR.unique !== newR.unique)
		mismatches.push(
			`${tag}: ${label} old=${JSON.stringify(oldR)} probe=${JSON.stringify(newR)}`,
		)
}

const runDifferential = (components: ComponentIR[]): void => {
	// A stable id per compose node for identity comparison.
	const registry: ReadonlyMap<string, RegistryEntry> = new Map(
		components.map(c => [
			c.source,
			{
				tag: c.tag,
				name: c.name,
				source: c.source,
				serverModule: '',
				clientModule: '',
				css: '',
				propsType: null,
				exposedProps: {},
				renderedShapes: renderedShapesOf(c),
			} as unknown as RegistryEntry,
		]),
	)
	for (const component of components)
		(component as { composedShapes?: unknown }).composedShapes =
			composedShapesFor(component.root, registry)

	let elementCount = 0
	let controlCount = 0
	let loopCount = 0
	let composeCount = 0
	let selectorQueries = 0

	for (const component of components) {
		const { root } = component
		const shapes = component.composedShapes
		const tag = component.tag

		const elements: ElementNode[] = []
		const ifs: IfNode[] = []
		const switches: SwitchNode[] = []
		const trys: TryNode[] = []
		walkTemplate(root, node => {
			if (node.kind === 'element') elements.push(node)
			else if (node.kind === 'if') ifs.push(node)
			else if (node.kind === 'switch') switches.push(node)
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
					resolveSelectorIn(forIR.output, el, shapes),
					probeResolveSelectorIn(forIR.output, el, shapes),
				)
		}

		// All candidate selectors ever synthesized, per element.
		const selectors = new Set<string>()
		for (const el of elements)
			for (const s of candidatesOf(el)) selectors.add(s)

		// 1. countForSelector, per selector.
		for (const sel of selectors) {
			selectorQueries++
			const oldC = countForSelector(root, sel)
			const newC = probeCountForSelector(root, sel)
			if (oldC !== newC)
				mismatches.push(
					`${tag}: countForSelector(${sel}) old=${oldC} probe=${newC}`,
				)
		}

		// 2. matchesUnder, per arm of every control node × every selector.
		const arms: Array<[string, readonly TemplateNode[]]> = []
		for (const node of ifs)
			arms.push(
				[`if.then@${pos(node)}`, node.then],
				[`if.alt@${pos(node)}`, node.alternate],
			)
		for (const node of switches)
			node.cases.forEach((arm, i) =>
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
				const oldM = matchesUnder(armNodes, sel)
				const newM = probeMatchesUnder(armNodes, sel)
				if (oldM !== newM)
					mismatches.push(
						`${tag}: matchesUnder(${label}, ${sel}) old=${oldM} probe=${newM}`,
					)
			}

		// 3. resolveSelector + selectorFor, per element.
		for (const el of elements) {
			const where = describeEl(el)
			compareResolved(
				tag,
				`resolveSelector ${where}`,
				resolveSelector(component, el),
				probeResolveSelectorIn(root, el, shapes),
			)
			compareResolved(
				tag,
				`selectorFor ${where}`,
				selectorFor(component, el),
				probeSelectorFor(root, el, shapes),
			)
		}

		// 4. resolveExclusiveSelectorIn, per control-node branch root.
		for (const node of ifs)
			for (const [body, other] of [
				[node.then, node.alternate],
				[node.alternate, node.then],
			] as Array<[readonly TemplateNode[], readonly TemplateNode[]]>)
				for (const el of body.filter(n => n.kind === 'element'))
					compareResolved(
						tag,
						`exclusive if ${describeEl(el as ElementNode)}`,
						resolveExclusiveSelectorIn(root, el as ElementNode, other, shapes),
						probeResolveExclusiveSelectorIn(
							root,
							el as ElementNode,
							other,
							shapes,
						),
					)
		for (const node of switches)
			for (let i = 0; i < node.cases.length; i++) {
				const arm = node.cases[i]
				if (!arm) continue
				const other = node.cases
					.filter((_, j) => j !== i)
					.flatMap(a => a.children)
				for (const el of arm.children.filter(n => n.kind === 'element'))
					compareResolved(
						tag,
						`exclusive switch[${i}] ${describeEl(el as ElementNode)}`,
						resolveExclusiveSelectorIn(root, el as ElementNode, other, shapes),
						probeResolveExclusiveSelectorIn(
							root,
							el as ElementNode,
							other,
							shapes,
						),
					)
			}

		// 5. compose cascades.
		const composeNodes = allComposeNodes(root)
		composeCount += composeNodes.length
		const sources = [...new Set(composeNodes.map(n => n.source))]
		if (ids(allComposeNodes(root)) !== ids(probeAllComposeNodes(root)))
			mismatches.push(
				`${tag}: allComposeNodes old=[${ids(allComposeNodes(root))}] probe=[${ids(probeAllComposeNodes(root))}]`,
			)
		for (const source of sources) {
			const oldC = countComposeBySource(root, source)
			const newC = probeCountComposeBySource(root, source)
			if (oldC !== newC)
				mismatches.push(
					`${tag}: countComposeBySource(${source}) old=${oldC} probe=${newC}`,
				)
			const oldN = ids(allComposeNodes(root).filter(n => n.source === source))
			const newN = ids(probeComposeNodesBySource(root, source))
			if (oldN !== newN)
				mismatches.push(
					`${tag}: composeNodesBySource(${source}) old=[${oldN}] probe=[${newN}]`,
				)
		}
	}

	console.log(
		`[LT-245 spike] components=${components.length} elements=${elementCount} ` +
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
				/^[A-Za-z_-][\w-]*$/.test(token)
					? `${prefix}.${token}`
					: exact('class', className),
			)
	const id = attrs.get('id')
	if (typeof id === 'string')
		out.add(/^[A-Za-z_-][\w-]*$/.test(id) ? `${prefix}#${id}` : exact('id', id))
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

test('differential: old cascades vs materialized probe over the corpus', async () => {
	const files = await loadCorpus()
	const components: ComponentIR[] = []
	for (const file of files) {
		const { component } = compileCorpusSource(file.content, file.path)
		if (component) components.push(component as ComponentIR)
	}
	expect(components.length).toBeGreaterThan(15)
	runDifferential(components)
	expect(mismatches).toEqual([])
}, 120_000)

/* === 2. Synthetic pins for constructs the corpus never exercises === */

const CHILD = `export function BasicChild({ label }: { label: string })
	@{
		expose({ value: '' })
		<>
			<basic-child>{label}</basic-child>
		</>
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
		<>
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
		</>
	}
import { expose } from '@zeix/le-truc'`,
	],
	// @try WITHOUT @pending: body XOR catch (max), same-tag roots.
	[
		'examples/spike/probe-try.tsrx',
		`export function ProbeTry({ data }: { data: string })
	@{
		expose({})
		<>
			<probe-try>
				@try {
					<p class="body">{data}</p>
				} @catch (e) {
					<p class="error">{e.message}</p>
				}
			</probe-try>
		</>
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
		<>
			<probe-pending>
				@try {
					<p class="body">{data}</p>
				} @pending {
					<p class="loading">loading…</p>
				} @catch (e) {
					<p class="error">{e.message}</p>
				}
			</probe-pending>
		</>
	}`,
	],
	// Nested exclusivity: @if inside @if branches, same-tag leaves.
	[
		'examples/spike/probe-nested.tsrx',
		`export function ProbeNested({ a, b }: { a: boolean; b: boolean })
	@{
		expose({})
		<>
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
		</>
	}
import { expose } from '@zeix/le-truc'`,
	],
	// Void elements and HTML tree correction (`<p>` auto-closes before a
	// `<div>`): one-clause counts must survive the round trip.
	[
		'examples/spike/probe-html.tsrx',
		`export function ProbeHtml({ text }: { text: string })
	@{
		expose({})
		<>
			<probe-html>
				<p>intro {text}</p>
				<p><div class="flow">blocks</div></p>
				<input type="text" placeholder="type here" />
				<br/>
			</probe-html>
		</>
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
		<>
			<probe-compose>
				<BasicChild label={'a'} class="first" />
				@if (alt) {
					<BasicChild label={'b'} class="second" />
				}
			</probe-compose>
		</>
	}`,
	],
]

test('differential: synthetic pins for switch/try/pending/nested/html', () => {
	const child = compileCorpusSource(CHILD, 'examples/child/basic-child.tsrx')
	if (!child.component) throw new Error('child must compile')
	const components: ComponentIR[] = [child.component as ComponentIR]
	let htmlCorrected: ComponentIR | null = null
	for (const [path, content] of SYNTHETICS) {
		const { component, diagnostics } = compileCorpusSource(content, path)
		if (!component)
			throw new Error(`${path} must compile: ${JSON.stringify(diagnostics)}`)
		if (path.endsWith('probe-html.tsrx')) {
			htmlCorrected = component as ComponentIR
			continue
		}
		components.push(component as ComponentIR)
	}
	runDifferential(components)
	expect(mismatches).toEqual([])

	// probe-html is pinned SEPARATELY, as the record of the one divergence
	// class the probe introduces: HTML5 tree correction. The authored
	// `<p><div>…</div></p>` parses in a browser (and in parse5) with the
	// div auto-closing the paragraph, and the implied `</p>` end tag
	// inserts an empty third `<p>` — so a real DOM has 3, the IR has 2.
	// The IR-walked proof believes 2; the probe believes what the browser
	// builds. The corpus never authors content-model-violating nesting
	// (mismatches=0 above), so this is a latent-unsoundness note, not a
	// corpus divergence: a GO must either accept browser-faithful counts
	// or neutralize content-model correction at materialization.
	if (!htmlCorrected) throw new Error('probe-html must compile')
	expect(countForSelector(htmlCorrected.root, 'p')).toBe(2)
	expect(probeCountForSelector(htmlCorrected.root, 'p')).toBe(3)
})
