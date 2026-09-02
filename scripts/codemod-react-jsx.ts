#!/usr/bin/env bun

/**
 * Migration codemod for LT-054's five React JSX near-misses. TSRX hard-
 * errors on `{cond && <jsx/>}` (TSRX021), `{cond ? <a/> : <b/>}` (TSRX022),
 * `.map()` producing JSX in child position (TSRX023), `return (<>…</>)`
 * (TSRX024), and `className`/`htmlFor` (TSRX006) — not because they fail to
 * parse (they're ordinary JS/JSX), but because @tsrx/core's pinned grammar
 * has no implicit conditional-render or loop-render rule: every one of them
 * compiled silently into broken output before those diagnostics existed
 * (verified empirically when LT-054 was scoped).
 *
 * A developer migrating a React component from `.tsx` to `.tsrx` writes
 * these idioms out of habit. This script rewrites the common, unambiguous
 * shape of each into its native TSRX form so migration is "swap the
 * extension, run the codemod" rather than "swap the extension, chase five
 * kinds of compile error by hand." The compiler's diagnostics remain the
 * safety net for anything this script doesn't rewrite.
 *
 * Deliberately single-pass and non-recursive into a rewritten span: a
 * near-miss nested inside another near-miss (`{a ? <x/> : b ? <y/> : <z/>}`)
 * is fixed one level per run. Re-run until it reports no more matches, or
 * until `check:tsrx` reports no more TSRX021-024/TSRX006 diagnostics for the
 * file.
 *
 * Usage: bun scripts/codemod-react-jsx.ts <file.tsrx> [...more files]
 */

import type { TsrxNode } from '@tsrx/core'
import { asArray, identifierName, isNode, text } from '../server/tsrx/ast-utils'
import { parseModule } from '../server/tsrx/core'

/* === Types === */

type Edit = { start: number; end: number; replacement: string }

/* === Internal Functions === */

const isJsxNode = (node: unknown): boolean => {
	const t = isNode(node) ? String(node.type) : null
	return t === 'JSXElement' || t === 'JSXFragment'
}

/** Does an arrow/function body produce JSX, directly or via a `return`? */
const jsxBodyOf = (body: unknown): TsrxNode | null => {
	if (isJsxNode(body)) return body as TsrxNode
	if (!isNode(body) || body.type !== 'BlockStatement') return null
	const ret = asArray(body.body).find(
		stmt => stmt.type === 'ReturnStatement' && isJsxNode(stmt.argument),
	)
	return ret ? (ret.argument as TsrxNode) : null
}

const nodeRange = (node: TsrxNode): { start: number; end: number } | null =>
	typeof node.start === 'number' && typeof node.end === 'number'
		? { start: node.start, end: node.end }
		: null

/**
 * Walk the whole module once, collecting non-overlapping edits for the five
 * near-misses. Stops descending into a node once it has queued an edit for
 * it — the replacement text is a verbatim source slice, so anything nested
 * inside is carried through unconverted and picked up on the next run.
 */
const collectEdits = (source: string, ast: TsrxNode): Edit[] => {
	const edits: Edit[] = []

	const visit = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child)
			return
		}
		if (!isNode(node)) return

		if (node.type === 'JSXAttribute' && isNode(node.name)) {
			const raw = String((node.name as TsrxNode).name ?? '')
			const rename =
				raw === 'className' ? 'class' : raw === 'htmlFor' ? 'for' : null
			const range = rename ? nodeRange(node.name as TsrxNode) : null
			if (rename && range) edits.push({ ...range, replacement: rename })
			// Attribute names have no children worth descending into.
			return
		}

		if (node.type === 'ReturnStatement' && isJsxNode(node.argument)) {
			const stmtRange = nodeRange(node)
			const argRange = nodeRange(node.argument as TsrxNode)
			if (stmtRange && argRange) {
				edits.push({
					start: stmtRange.start,
					end: argRange.start,
					replacement: '',
				})
				edits.push({ start: argRange.end, end: stmtRange.end, replacement: '' })
			}
			return
		}

		if (node.type === 'JSXExpressionContainer' && isNode(node.expression)) {
			const expr = node.expression as TsrxNode
			const range = nodeRange(node)
			if (!range) {
				visit(node.expression)
				return
			}

			if (
				expr.type === 'LogicalExpression' &&
				expr.operator === '&&' &&
				isJsxNode(expr.right)
			) {
				const condText = text(source, expr.left as TsrxNode)
				const jsxText = text(source, expr.right as TsrxNode)
				edits.push({
					...range,
					replacement: `@if (${condText}) {\n\t${jsxText}\n}`,
				})
				return
			}

			if (
				expr.type === 'ConditionalExpression' &&
				(isJsxNode(expr.consequent) || isJsxNode(expr.alternate))
			) {
				const condText = text(source, expr.test as TsrxNode)
				const thenText = text(source, expr.consequent as TsrxNode)
				const elseText = text(source, expr.alternate as TsrxNode)
				edits.push({
					...range,
					replacement: `@if (${condText}) {\n\t${thenText}\n} @else {\n\t${elseText}\n}`,
				})
				return
			}

			if (
				expr.type === 'CallExpression' &&
				isNode(expr.callee) &&
				expr.callee.type === 'MemberExpression' &&
				!expr.callee.computed &&
				identifierName(expr.callee.property) === 'map'
			) {
				const callback = asArray(expr.arguments)[0]
				const jsxBody = callback ? jsxBodyOf(callback.body) : null
				if (
					callback &&
					/Function(Expression)?$/.test(callback.type) &&
					jsxBody
				) {
					const itemName = identifierName(asArray(callback.params)[0]) ?? 'item'
					const arrayText = text(
						source,
						(expr.callee as TsrxNode).object as TsrxNode,
					)
					const bodyText = text(source, jsxBody)
					edits.push({
						...range,
						replacement: `@for (const ${itemName} of ${arrayText}) {\n\t${bodyText}\n}`,
					})
					return
				}
			}

			visit(expr)
			return
		}

		for (const [key, value] of Object.entries(node)) {
			if (key === 'loc' || key === 'range' || key === 'parent') continue
			visit(value)
		}
	}

	visit(ast)
	return edits
}

const applyEdits = (source: string, edits: Edit[]): string => {
	const sorted = [...edits].sort((a, b) => b.start - a.start)
	let out = source
	for (const edit of sorted)
		out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end)
	return out
}

/* === Entry Point === */

const files = process.argv.slice(2)
if (files.length === 0) {
	console.error(
		'Usage: bun scripts/codemod-react-jsx.ts <file.tsrx> [...more files]',
	)
	process.exit(1)
}

for (const file of files) {
	const source = await Bun.file(file).text()
	let ast: TsrxNode
	try {
		ast = parseModule(source, file)
	} catch (e) {
		console.error(
			`${file}: skipped — parse error (${e instanceof Error ? e.message : String(e)})`,
		)
		continue
	}
	const edits = collectEdits(source, ast)
	if (edits.length === 0) {
		console.log(`${file}: no React JSX idioms found`)
		continue
	}
	await Bun.write(file, applyEdits(source, edits))
	console.log(
		`${file}: applied ${edits.length} rewrite(s) — re-run to catch any nested idioms`,
	)
}
