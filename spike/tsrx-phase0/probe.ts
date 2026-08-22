/**
 * Phase 0 probe: test @tsrx/core 0.1.60 against the spike sources.
 *
 * Answers the deferred plan's viability questions:
 * 1. Does parseModule accept our Option C file shape (TS client half +
 *    `component` declaration server half + <style> block)?
 * 2. What AST do we get — can an emitter walk it?
 * 3. Do the CSS utilities allow tag-scoped emission (no class hashing),
 *    and do they round-trip deeply nested CSS?
 * 4. Does `const component = ...` still parse as an identifier now that
 *    `component` is contextual syntax?
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const core = await import('@tsrx/core')

console.log('=== @tsrx/core exports ===')
console.log(Object.keys(core).sort().join(', '))

// Locate parseModule (or its current equivalent)
const parseNames = Object.keys(core).filter(k => /parse/i.test(k))
console.log('\nparse-related exports:', parseNames.join(', '))

const sourcesDir = path.resolve(import.meta.dir, 'sources')

// Collect every interesting node type into a frequency table
const nodeTypes = new Map<string, number>()
const bump = (t: string) => nodeTypes.set(t, (nodeTypes.get(t) ?? 0) + 1)

const walk = (node: unknown, depth = 0, visit: (n: any) => void) => {
	if (!node || typeof node !== 'object' || depth > 60) return
	if (Array.isArray(node)) {
		for (const n of node) walk(n, depth + 1, visit)
		return
	}
	const n = node as any
	if (typeof n.type === 'string') visit(n)
	for (const key of Object.keys(n)) {
		if (key === 'loc' || key === 'range' || key === 'parent') continue
		const value = n[key]
		if (value && typeof value === 'object') walk(value, depth + 1, visit)
	}
}

const describeTree = (ast: any, label: string) => {
	nodeTypes.clear()
	const interesting: string[] = []
	walk(ast, 0, (n: any) => {
		bump(n.type)
		if (
			/(Component|JSX|Style|Template|Tsrx|Control|For|If)/i.test(n.type) &&
			n.type !== 'JSXIdentifier' &&
			n.type !== 'JSXNamespacedName'
		) {
			if (interesting.length < 60) {
				const extra =
					typeof n.name === 'object' && n.name?.name
						? ` name=${n.name.name}`
						: typeof n.name === 'string'
							? ` name=${n.name}`
							: ''
				interesting.push(`  ${n.type}${extra} keys=[${Object.keys(n).filter(k => !['loc', 'range', 'start', 'end', 'parent'].includes(k)).join(',')}]`)
			}
		}
	})
	console.log(`\n--- ${label}: node type frequencies (top 40) ---`)
	;[...nodeTypes.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 40)
		.forEach(([t, c]) => console.log(`  ${t}: ${c}`))
	console.log(`--- ${label}: interesting nodes ---`)
	interesting.forEach(l => console.log(l))
}

const parseFn =
	(core as any).parseModule ??
	(core as any).parse ??
	(core as any)[parseNames[0] ?? '']

if (typeof parseFn !== 'function') {
	console.log('\n!! No parse entry point found among:', parseNames)
} else {
	for (const file of ['basic-counter.tsrx', 'module-tabgroup.tsrx']) {
		const source = fs.readFileSync(path.join(sourcesDir, file), 'utf8')
		console.log(`\n========== parsing ${file} ==========`)
		try {
			const result = parseFn(source, file)
			// Some parsers return { ast, diagnostics, ... }, others the AST directly
			const ast = (result as any).ast ?? result
			const diagnostics = (result as any).diagnostics
			if (Array.isArray(diagnostics) && diagnostics.length) {
				console.log('diagnostics:', JSON.stringify(diagnostics, null, 2).slice(0, 2000))
			}
			console.log('parse OK — top-level shape:',
				typeof ast?.type === 'string' ? ast.type : Object.keys(ast ?? {}).slice(0, 20))
			describeTree(ast, file)
			if (typeof (core as any).analyzeTsrx === 'function') {
				try {
					const analysis = (core as any).analyzeTsrx(ast, file)
					console.log('analyzeTsrx OK:', String(JSON.stringify(analysis)).slice(0, 600))
				} catch (e) {
					console.log('analyzeTsrx FAILED:', (e as Error).message?.slice(0, 600))
				}
			}
		} catch (e) {
			console.log('parse FAILED:', (e as Error).message?.slice(0, 1500))
		}
	}

	// Naming question: does `const component = 1` still parse?
	try {
		const r = parseFn('const component = 1; export { component }', {
			filename: 'naming.tsrx',
		})
		console.log('\n`const component = 1` parses:', !!r)
	} catch (e) {
		console.log('\n`const component = 1` FAILS:', (e as Error).message?.slice(0, 300))
	}
}

// CSS utilities
const cssNames = Object.keys(core).filter(k => /css|style/i.test(k))
console.log('\nCSS/style-related exports:', cssNames.join(', '))

const styleBlock = `module-tabgroup {
	display: block;
	> [role="tablist"] {
		display: flex;
		> [role="tab"] {
			border: 0;
			&:hover, &:focus { color: red; }
			&[aria-selected="true"] { border-top: 3px solid blue; }
		}
	}
}`

for (const name of cssNames) {
	const fn = (core as any)[name]
	if (typeof fn !== 'function') continue
	console.log(`\n--- ${name}() ---`)
	try {
		const r = fn(styleBlock)
		const printed =
			typeof r === 'string'
				? r
				: JSON.stringify(r, (k, v) => (k === 'loc' || k === 'range' ? undefined : v))
		console.log(String(printed).slice(0, 1200))
	} catch (e) {
		console.log('FAILED:', (e as Error).message?.slice(0, 300))
	}
}
