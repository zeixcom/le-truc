/**
 * Phase 1 probe: precise AST shapes the Le Truc emitter must consume.
 *
 * Dumps (loc-stripped) JSON of the nodes the compiler walks:
 * - the component FunctionDeclaration + @{ } JSXCodeBlock (body + render)
 * - JSXAttribute variants: static, thunk, class map, ref, event
 * - the &{expr} lazy child representation
 * - @for (JSXForExpression) params/body/keys
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseModule } from '@tsrx/core'

const strip = (node: unknown, depth = 0): unknown => {
	if (depth > 40) return '[depth]'
	if (Array.isArray(node)) return node.map(n => strip(n, depth + 1))
	if (!node || typeof node !== 'object') return node
	const out: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
		if (['loc', 'start', 'end', 'parent', 'range'].includes(k)) continue
		if (k === 'stylesheet') {
			out[k] = { source: String((v as any)?.source ?? '').slice(0, 60) + '…' }
			continue
		}
		out[k] = strip(v, depth + 1)
	}
	return out
}

const dir = path.resolve(import.meta.dir, 'unified')
const walk = (node: unknown, visit: (n: any) => void, depth = 0) => {
	if (!node || typeof node !== 'object' || depth > 80) return
	if (Array.isArray(node)) {
		for (const n of node) walk(n, visit, depth + 1)
		return
	}
	const n = node as any
	if (typeof n.type === 'string') visit(n)
	for (const key of Object.keys(n)) {
		if (['loc', 'range', 'parent'].includes(key)) continue
		const value = n[key]
		if (value && typeof value === 'object') walk(value, visit, depth + 1)
	}
}

for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.tsrx'))) {
	const source = fs.readFileSync(path.join(dir, file), 'utf8')
	const ast: any = parseModule(source, file)

	console.log(`\n========== ${file} ==========`)

	// 1. component function declarations (body = JSXCodeBlock)
	const codeBlocks: any[] = []
	walk(ast, n => {
		if (n.type === 'JSXCodeBlock') codeBlocks.push(n)
	})

	console.log(`JSXCodeBlocks: ${codeBlocks.length}`)
	for (const cb of codeBlocks) {
		console.log('-- JSXCodeBlock.body statements --')
		for (const stmt of cb.body ?? []) {
			console.log(JSON.stringify(strip(stmt)).slice(0, 700))
		}
		console.log('-- JSXCodeBlock.render --')
		console.log(JSON.stringify(strip(cb.render), null, 1).slice(0, 2500))
	}

	// 2. every JSXAttribute in the file, compactly
	console.log('-- all JSXAttributes (name → value expr) --')
	walk(ast, n => {
		if (n.type !== 'JSXAttribute') return
		const name = typeof n.name === 'object' ? n.name.name ?? n.name : n.name
		const v = n.value
		const describe = (x: any): string => {
			if (!x) return '(none)'
			if (x.type === 'JSXExpressionContainer') return describe(x.expression)
			if (x.type === 'Identifier') return `Identifier(${x.name})`
			if (x.type === 'Literal') return `Literal(${JSON.stringify(x.value)})`
			if (x.type === 'ArrowFunctionExpression')
				return `Arrow(${x.params.length} params, ${x.body.type})`
			if (x.type === 'ObjectExpression')
				return `Object(${x.properties.map((p: any) => p.key?.name ?? p.key?.value).join(',')})`
			return x.type
		}
		console.log(
			`  ${String(name)}: ${describe(v)} extraKeys=${Object.keys(n).filter(k => !['loc', 'range', 'start', 'end', 'parent', 'type', 'name', 'value'].includes(k)).join(',') || '-'} nameKeys=${Object.keys(n.name ?? {}).filter(k => !['loc', 'range', 'start', 'end', 'parent', 'type'].includes(k)).join(',') || '-'}`,
		)
	})

	// 3. lazy &{} children vs plain {} children
	console.log('-- JSXExpressionContainer children (lazy marker?) --')
	walk(ast, n => {
		if (n.type !== 'JSXExpressionContainer') return
		const meta = n.metadata ?? {}
		console.log(
			`  expr=${n.expression?.type} extraKeys=${Object.keys(n).filter(k => !['loc', 'range', 'start', 'end', 'parent', 'type', 'expression'].includes(k)).join(',') || '-'} metadata=${JSON.stringify(strip(meta))}`,
		)
	})

	// 4. @for nodes
	console.log('-- JSXForExpression nodes --')
	walk(ast, n => {
		if (n.type !== 'JSXForExpression') return
		console.log(JSON.stringify(strip(n), null, 1).slice(0, 2200))
	})

	// 5. function declarations at top level
	console.log('-- top-level functions --')
	for (const stmt of ast.body ?? []) {
		if (
			stmt.type === 'ExportNamedDeclaration' &&
			stmt.declaration?.type === 'FunctionDeclaration'
		) {
			console.log(
				`export function ${stmt.declaration.id?.name} generator=${stmt.declaration.generator} bodyType=${stmt.declaration.body?.type}`,
			)
		} else if (stmt.type === 'FunctionDeclaration') {
			console.log(`function ${stmt.id?.name} bodyType=${stmt.body?.type}`)
		}
	}
}
