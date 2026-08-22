/**
 * Phase 0 probe 2: answer the two remaining emitter questions precisely.
 *
 * 1. Can we extract the <style> block's CSS and emit it verbatim (tag-scoped,
 *    no class hashing) via the official stylesheet pipeline?
 * 2. Are @for control-flow nodes walkable with the public predicates?
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
	getStyleElementStylesheet,
	isCodeBlockFunctionBody,
	isStyleElement,
	isTemplateForOfNode,
	parseModule,
	prepareStylesheetForRender,
	renderStylesheets,
} from '@tsrx/core'

const source = fs.readFileSync(
	path.resolve(import.meta.dir, 'sources/module-tabgroup.tsrx'),
	'utf8',
)
const ast = parseModule(source, 'module-tabgroup.tsrx')

const walk = (node: unknown, visit: (n: any) => void, depth = 0) => {
	if (!node || typeof node !== 'object' || depth > 80) return
	if (Array.isArray(node)) {
		for (const n of node) walk(n, visit, depth + 1)
		return
	}
	const n = node as any
	if (typeof n.type === 'string') visit(n)
	for (const key of Object.keys(n)) {
		if (key === 'loc' || key === 'range' || key === 'parent') continue
		const value = n[key]
		if (value && typeof value === 'object') walk(value, visit, depth + 1)
	}
}

// 1. Style element + verbatim emission
const styleNodes: any[] = []
walk(ast, (n) => {
	if (isStyleElement(n)) styleNodes.push(n)
})
console.log('style elements found:', styleNodes.length)

if (styleNodes[0]) {
	const stylesheet = getStyleElementStylesheet(styleNodes[0])
	console.log('\nstylesheet object keys:', Object.keys(stylesheet ?? {}))
	console.log('stylesheet type:', (stylesheet as any)?.type)

	// Try the full render pipeline first
	try {
		const prepared = prepareStylesheetForRender(stylesheet as any)
		const rendered = renderStylesheets([prepared as any])
		console.log('\nrenderStylesheets output (first 500 chars):')
		console.log(String(rendered).slice(0, 500))
	} catch (e) {
		console.log('\nrender pipeline needs different args:', (e as Error).message?.slice(0, 200))
	}

	// Look for the raw text on the node itself
	const raw = (styleNodes[0] as any).children?.map((c: any) => c.value ?? c.raw ?? '').join('')
	console.log('\nraw style text from node children (first 300 chars):')
	console.log(String(raw).slice(0, 300))
}

// 2. @for walkability
const forNodes: any[] = []
const codeBlocks: any[] = []
walk(ast, (n) => {
	if (isTemplateForOfNode(n)) forNodes.push(n)
	if (isCodeBlockFunctionBody(n)) codeBlocks.push(n)
})
console.log('\n@for template nodes found:', forNodes.length)
if (forNodes[0]) {
	console.log('@for node keys:', Object.keys(forNodes[0]).filter(k => !['loc', 'range', 'start', 'end'].includes(k)))
	console.log('@for node type:', forNodes[0].type)
}
console.log('JSXCodeBlock function bodies found:', codeBlocks.length)
