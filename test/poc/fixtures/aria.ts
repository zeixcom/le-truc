/**
 * Computed-accessibility ground-truth harness for the ARIA-reflection PoC
 * (ADR 0026, TODO.md LT-001). Three observation tiers with very different
 * trust levels — see test/poc/README.md for the findings matrix:
 *
 * 1. `computedAriaTree()` — Chromium only. The engine's own accessibility
 *    tree via CDP (`Accessibility.getFullAXTree`). This is what assistive
 *    technology consumes; it is ground truth for "does the browser see it".
 * 2. `ariaSnapshotOf()` / Playwright `getByRole` — the tooling tier: what
 *    Playwright's injected ARIA engine computes from the DOM. Runs on all
 *    engines, but is a *tool's view*, not the platform's.
 * 3. `runAxe()` — axe-core ≥ 4.13 executed in the page, reading
 *    ElementInternals through the element-internals-declaration registry
 *    (`globalThis._elementInternals`) when the page populates it.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CDPSession, Page } from '@playwright/test'

/* === Types === */

export type AriaNodeSnapshot = {
	role: string
	name: string
	value: string
	props: Record<string, string>
	children: AriaNodeSnapshot[]
}

export type AxeViolationSummary = {
	id: string
	impact: string | null
	nodes: number
}

/* Minimal structural typings for the CDP accessibility nodes we consume. */
type CdpValue = { value?: unknown; type?: string }
type CdpAxNode = {
	nodeId: string
	backendDOMNodeId?: number
	ignored?: boolean
	role?: CdpValue
	name?: CdpValue
	value?: CdpValue
	properties?: { name: string; value: CdpValue }[]
	childIds?: string[]
}
type CdpAxTree = { nodes: CdpAxNode[] }

/* === Helpers === */

export const engineOf = (page: Page): string =>
	page.context().browser()?.browserType().name() ?? 'unknown'

const stringValue = (v: CdpValue | undefined): string => {
	if (v == null) return ''
	const raw = (v as { value?: unknown }).value
	return raw == null ? '' : String(raw)
}

/**
 * The engine's accessibility subtree for the element matching `selector`,
 * Chromium-only (CDP). The subtree is sliced from the full AX tree by
 * backend DOM node id; `ignored` wrapper nodes are skipped so callers see
 * the semantic content directly.
 */
export async function computedAriaTree(
	page: Page,
	selector: string,
): Promise<AriaNodeSnapshot> {
	if (engineOf(page) !== 'chromium')
		throw new Error('computedAriaTree() uses CDP — Chromium only')
	let session: CDPSession | undefined
	try {
		session = await page.context().newCDPSession(page)
		await session.send('DOM.enable')
		const { root } = (await session.send('DOM.getDocument')) as {
			root: { nodeId: number }
		}
		const { nodeId } = (await session.send('DOM.querySelector', {
			nodeId: root.nodeId,
			selector,
		})) as { nodeId: number }
		if (!nodeId) throw new Error(`no element matches ${selector}`)
		const { node } = (await session.send('DOM.describeNode', {
			nodeId,
		})) as { node: { backendNodeId: number } }
		const { nodes } = (await session.send(
			'Accessibility.getFullAXTree',
		)) as unknown as CdpAxTree
		const byId = new Map(nodes.map(n => [n.nodeId, n]))
		const rootAxNode = nodes.find(
			n => n.backendDOMNodeId === node.backendNodeId,
		)
		if (!rootAxNode) throw new Error(`no AX node in tree for ${selector}`)
		const build = (axNode: CdpAxNode): AriaNodeSnapshot => ({
			role: stringValue(axNode.role),
			name: stringValue(axNode.name),
			value: stringValue(axNode.value),
			props: Object.fromEntries(
				(axNode.properties ?? []).map(p => [p.name, stringValue(p.value)]),
			),
			children: (axNode.childIds ?? [])
				.map(id => byId.get(id))
				.filter((n): n is CdpAxNode => n != null && !n.ignored)
				.map(build),
		})
		return build(rootAxNode)
	} finally {
		session?.detach().catch(() => {})
	}
}

/** Depth-first search for the first node with the given role. */
export function findAriaNode(
	tree: AriaNodeSnapshot,
	role: string,
): AriaNodeSnapshot | undefined {
	if (tree.role === role) return tree
	for (const child of tree.children) {
		const found = findAriaNode(child, role)
		if (found) return found
	}
	return undefined
}

/**
 * The tooling tier (all engines): Playwright's own ARIA computation for the
 * element, as YAML. What this sees is a Playwright capability question, not
 * a platform fact — findings are recorded in README.md.
 */
export const ariaSnapshotOf = (page: Page, selector: string): Promise<string> =>
	page.locator(selector).ariaSnapshot()

let axeSource: string | undefined

/* Minimal typings for the slice of the axe runtime we drive in-page. */
type AxeLike = {
	run: (
		context: Element | Document,
		options: Record<string, unknown>,
	) => Promise<{
		violations: {
			id: string
			impact: string | null
			nodes: unknown[]
		}[]
	}>
}

/**
 * Run axe-core (devDependency, ≥ 4.13 for ElementInternals support) inside
 * the page and return a compact violation summary. axe discovers
 * ElementInternals only through the element-internals-declaration registry,
 * which the PoC components populate.
 */
export async function runAxe(
	page: Page,
	selector = 'body',
): Promise<AxeViolationSummary[]> {
	axeSource ??= await readFile(
		join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js'),
		'utf8',
	)
	return page.evaluate(
		async ([source, sel]) => {
			const w = window as unknown as { axe?: AxeLike }
			if (!w.axe) {
				const script = document.createElement('script')
				script.textContent = source
				document.head.append(script)
			}
			const axe = w.axe
			if (!axe) throw new Error('axe-core failed to load')
			const context = document.querySelector(sel) ?? document
			const results = await axe.run(context, {
				resultTypes: ['violations', 'incomplete'],
			})
			return results.violations.map(v => ({
				id: v.id,
				impact: v.impact ?? null,
				nodes: v.nodes.length,
			}))
		},
		[axeSource, selector] as const,
	)
}
