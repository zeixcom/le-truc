/**
 * Phase 1 probe 5: the last emitter questions.
 *
 * - module-list attributes (ref, disabled thunk, class map) + @for key clause
 * - &-sigil detection: JSXText("&") adjacency rule across all sources
 * - source slicing for verbatim statement emission (start/end offsets)
 * - core predicates: isEventAttribute, isBooleanAttribute, isVoidElement,
 *   normalizeEventName, isWhitespaceTextNode, isTemplateForOfNode
 * - getStyleElementStylesheet().source boundaries (verbatim round-trip)
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
	getStyleElementStylesheet,
	isBooleanAttribute,
	isEventAttribute,
	isStyleElement,
	isTemplateForOfNode,
	isVoidElement,
	isWhitespaceTextNode,
	normalizeEventName,
	parseModule,
} from '@tsrx/core'

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

	// attribute predicates on every JSXAttribute
	console.log('-- attributes with predicate results --')
	walk(ast, (n: any) => {
		if (n.type !== 'JSXAttribute') return
		const name = n.name?.name ?? n.name
		let valueDesc = 'none'
		if (n.value?.type === 'Literal') valueDesc = `lit(${n.value.value})`
		else if (n.value?.type === 'JSXExpressionContainer')
			valueDesc = `expr:${n.value.expression.type}`
		const ev = (() => {
			try {
				return isEventAttribute(n)
			} catch {
				return 'ERR'
			}
		})()
		const norm = (() => {
			try {
				return normalizeEventName(String(name))
			} catch {
				return 'ERR'
			}
		})()
		console.log(
			`  ${String(name)} value=${valueDesc} isEvent=${String(ev)} normalized=${norm} isBooleanAttr=${String(isBooleanAttribute(String(name)))}`,
		)
	})

	// & sigil adjacency
	console.log('-- JSXText nodes containing & --')
	walk(ast, (n: any) => {
		if (n.type !== 'JSXText') return
		if (!n.value.includes('&')) return
		console.log(
			`  JSXText ${JSON.stringify(n.value).slice(0, 40)} start=${n.start} end=${n.end} isWhitespace=${String(isWhitespaceTextNode(n))}`,
		)
	})

	// @for key clause shape
	console.log('-- @for clauses --')
	walk(ast, (n: any) => {
		if (!isTemplateForOfNode(n)) return
		console.log(
			`  left=${n.left.declarations[0].id.name} of right=${n.right.type}(${n.right.name ?? ''}) index=${n.index?.name ?? '-'} key=${n.key ? `${n.key.type}(${n.key.name ?? n.key.property?.name ?? '…'})` : '-'} bodyStmts=${n.body.body.map((s: any) => s.type).join(',')}`,
		)
	})

	// void elements check
	console.log('-- void element checks --')
	for (const tag of ['input', 'br', 'span', 'button']) {
		console.log(`  ${tag}: ${String(isVoidElement(tag))}`)
	}

	// verbatim statement slicing: setup statements round-trip?
	console.log('-- verbatim slicing of setup statements --')
	walk(ast, (n: any) => {
		if (n.type !== 'JSXCodeBlock') return
		for (const stmt of n.body ?? []) {
			const text = source.slice(stmt.start, stmt.end)
			console.log(`  [${stmt.start}..${stmt.end}] ${text.slice(0, 90).replace(/\n/g, '⏎')}`)
		}
	})

	// style source round-trip
	console.log('-- style elements --')
	walk(ast, (n: any) => {
		if (!isStyleElement(n)) return
		const sheet = getStyleElementStylesheet(n)
		const css = String(sheet?.source ?? '')
		console.log(`  source length=${css.length} first=${JSON.stringify(css.slice(0, 30))} last=${JSON.stringify(css.slice(-20))}`)
	})
}
