/**
 * Server-module emitter (ADR 0023 milestone 1, LT-001).
 *
 * Emits one module per component exporting `render<Name>(args): string`.
 * The generated function re-declares the source's `@{ }` setup verbatim —
 * executable because the signal constructors and `expose()` resolve to the
 * server runtime harness (signals are their initial values in a box) — and
 * then builds the HTML string:
 *
 * - `{expr}` over server data → escaped interpolation
 * - `&{expr}` lazy children and thunk attributes render their initial value
 *   when the dependency closure is server-known (args, setup names, loop
 *   bindings, hoisted consts); otherwise the attribute is omitted — the
 *   first client binding pass sets it (dependency-provable evaluation,
 *   ADR 0023 sub-design 3)
 * - `on*` event attributes and `ref` are stripped
 * - `@for` over server data renders once per item, hoisted consts included
 */

import {
	freeIdentifiers,
	isVoidTag,
	JS_GLOBALS,
	type ComponentIR,
	type ForIR,
	type TemplateNode,
} from './compiler'
import type { TsrxNode } from '@tsrx/core'

/* === Types === */

export type EmittedServerModule = {
	/** Full TypeScript source of the generated module. */
	code: string
	/** Runtime helper names the module imports. */
	runtimeImports: Set<string>
}

type ElementNode = Extract<TemplateNode, { kind: 'element' }>
type Part = { static: string } | { expr: string }

/* === Internal Functions === */

/** Escape a static segment for use inside a generated template literal. */
const tplEscape = (s: string): string =>
	s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

/** Render push parts as one `__html.push(...)` argument. */
const pushArgument = (parts: Part[]): string => {
	if (parts.every(p => 'static' in p)) {
		const joined = parts.map(p => (p as { static: string }).static).join('')
		return JSON.stringify(joined)
	}
	const body = parts
		.map(p => ('static' in p ? tplEscape(p.static) : `\${${p.expr}}`))
		.join('')
	return `\`${body}\``
}

const escapeAttrValue = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')

/** Free identifiers excluding JS globals — the dependency set that matters. */
const dependenciesOf = (node: TsrxNode): Set<string> => {
	const free = freeIdentifiers(node)
	for (const global of JS_GLOBALS) free.delete(global)
	return free
}

/**
 * Re-indent a verbatim slice for generated code: strip the source's common
 * indentation, apply `level` tabs (first line included).
 */
const reindent = (slice: string, level: number): string => {
	const lines = slice.split('\n')
	const indents = lines
		.filter(line => line.trim().length > 0 && !line.trimStart().startsWith('*'))
		.map(line => line.match(/^[ \t]*/)?.[0] ?? '')
	const common = indents.length
		? (indents.reduce((min, ind) => (ind.length < min.length ? ind : min)) ?? '')
		: ''
	const prefix = '\t'.repeat(level)
	return lines
		.map(line =>
			line.trim().length === 0
				? ''
				: prefix + (line.startsWith(common) ? line.slice(common.length) : line),
		)
		.join('\n')
}

/**
 * A lazy child's initial server value: a signal identifier reads `.get()`,
 * a thunk is invoked, an exposed-prop string key resolves through
 * `expose()`'s prop→signal map, anything else is the expression itself.
 */
const lazyValueExpression = (
	component: ComponentIR,
	exprText: string,
	expr: TsrxNode,
): string => {
	if (expr.type === 'Identifier') {
		const name = String(expr.name)
		if (component.signals.some(s => s.name === name)) return `${name}.get()`
		return exprText
	}
	if (
		expr.type === 'Literal' &&
		typeof expr.value === 'string' &&
		component.exposeProps.has(String(expr.value))
	) {
		const signal = component.exposeProps.get(String(expr.value)) as string
		return `${signal}.get()`
	}
	if (expr.type === 'ArrowFunctionExpression') return `(${exprText})()`
	return exprText
}

/* === Exported Functions === */

/**
 * Emit the server render module for a component IR.
 *
 * @param component - Component IR from compileSource
 * @param options.runtimeImport - Module specifier of the runtime harness
 * @param options.sourcePath - Source path for the generated header
 */
export const emitServerModule = (
	component: ComponentIR,
	options: { runtimeImport: string; sourcePath: string },
): EmittedServerModule => {
	const used = new Set<string>()
	const lines: string[] = []
	const tab = (depth: number) => '\t'.repeat(depth)

	const emit = (node: TemplateNode, scope: ReadonlySet<string>, depth: number): void => {
		if (node.kind === 'text') {
			lines.push(`${tab(depth)}__html.push(${JSON.stringify(node.value)})`)
			return
		}
		if (node.kind === 'expr') {
			used.add('esc')
			const value = node.lazy
				? lazyValueExpression(component, node.exprText, node.expr)
				: node.exprText
			lines.push(`${tab(depth)}__html.push(esc(String(${value})))`)
			return
		}
		const loop = [...component.fors.values()].find(f => f.output === node)
		if (loop) {
			emitFor(loop, scope, depth)
			return
		}
		emitElement(node, scope, depth)
		for (const child of node.children) emit(child, scope, depth)
		if (!isVoidTag(node.tag))
			lines.push(`${tab(depth)}__html.push('</${node.tag}>')`)
	}

	const emitElement = (element: ElementNode, scope: ReadonlySet<string>, depth: number): void => {
		const parts: Part[] = [{ static: `<${element.tag}` }]
		let staticClass: string | null = null
		let classExpr: string | null = null
		for (const attr of element.attrs) {
			switch (attr.kind) {
				case 'static':
					if (attr.name === 'class') staticClass = attr.value ?? ''
					else if (attr.value === null) parts.push({ static: ` ${attr.name}` })
					else
						parts.push({
							static: ` ${attr.name}="${escapeAttrValue(attr.value)}"`,
						})
					break
				case 'server':
					used.add('attr')
					parts.push({ expr: `attr('${attr.name}', ${attr.exprText})` })
					break
				case 'reactive':
					if (dependenciesOf(attr.thunk).isSubsetOf(scope)) {
						used.add('attr')
						parts.push({ expr: `attr('${attr.name}', (${attr.thunkText})())` })
					}
					break
				case 'class-map':
					if (dependenciesOf(attr.object).isSubsetOf(scope)) {
						used.add('cls')
						classExpr = `cls((${attr.thunkText})())`
					}
					break
				case 'event':
				case 'ref':
					break
			}
		}
		if (classExpr || staticClass !== null) {
			const prefix = staticClass ? `${escapeAttrValue(staticClass)}${classExpr ? ' ' : ''}` : ''
			if (classExpr) {
				parts.push({ static: ` class="${prefix}` })
				parts.push({ expr: classExpr })
				parts.push({ static: '"' })
			} else {
				parts.push({ static: ` class="${prefix}"` })
			}
		}
		parts.push({ static: '>' })
		lines.push(`${tab(depth)}__html.push(${pushArgument(parts)})`)
	}

	const emitFor = (loop: ForIR, scope: ReadonlySet<string>, depth: number): void => {
		const bodyText = [
			...loop.hoisted.map(h => h.initText),
			...loop.output.attrs.map(a =>
				'thunkText' in a ? a.thunkText : 'exprText' in a ? a.exprText : '',
			),
			...loop.output.children.map(c => ('exprText' in c ? c.exprText : '')),
		].join(' ')
		const usesIndex =
			loop.indexName !== null && new RegExp(`\\b${loop.indexName}\\b`).test(bodyText)
		used.add(usesIndex ? 'entries' : 'items')
		const loopScope = new Set(scope)
		loopScope.add(loop.itemName)
		if (loop.indexName) loopScope.add(loop.indexName)
		for (const hoisted of loop.hoisted) loopScope.add(hoisted.name)
		const binding = usesIndex
			? `const [${loop.indexName}, ${loop.itemName}] of entries(${loop.iterableText})`
			: `const ${loop.itemName} of items(${loop.iterableText})`
		lines.push(`${tab(depth)}for (${binding}) {`)
		for (const hoisted of loop.hoisted)
			lines.push(`${tab(depth + 1)}const ${hoisted.name} = ${hoisted.initText}`)
		emitElement(loop.output, loopScope, depth + 1)
		for (const child of loop.output.children) emit(child, loopScope, depth + 1)
		if (!isVoidTag(loop.output.tag))
			lines.push(`${tab(depth + 1)}__html.push('</${loop.output.tag}>')`)
		lines.push(`${tab(depth)}}`)
	}

	for (const child of component.root.children)
		emit(child, component.serverKnown, 1)

	// Root element opening: only static and server-definitive attributes
	// render; reactive/event/ref constructs on the root are the client
	// analyzer's to diagnose.
	const rootParts: Part[] = [{ static: `<${component.tag}` }]
	for (const attr of component.root.attrs) {
		if (attr.kind === 'static' && attr.value !== null)
			rootParts.push({ static: ` ${attr.name}="${escapeAttrValue(attr.value)}"` })
		else if (attr.kind === 'static')
			rootParts.push({ static: ` ${attr.name}` })
		else if (attr.kind === 'server') {
			used.add('attr')
			rootParts.push({ expr: `attr('${attr.name}', ${attr.exprText})` })
		}
	}
	rootParts.push({ static: '>' })

	for (const signal of component.signals) used.add(signal.constructor)
	if (component.exposeText) used.add('expose')

	const body: string[] = [
		'/**',
		' * Generated by the Le Truc TSRX compiler (ADR 0023, milestone 1) from',
		` * ${options.sourcePath} — DO NOT EDIT.`,
		' */',
	]
	if (used.size > 0) {
		const imports = [...used].sort()
		body.push(`import { ${imports.join(', ')} } from '${options.runtimeImport}'`)
	}
	body.push('')
	for (const decl of component.typeDecls) body.push(decl, '')
	// Verbatim param slice, re-indented: first line inline in the signature,
	// continuation lines keep their relative shape.
	const paramLines = reindent(component.paramsText, 2).split('\n')
	const paramFirst = paramLines[0]?.replace(/^\t\t/, '') ?? ''
	if (paramLines.length === 1) {
		body.push(`export function render${component.name}(${paramFirst}): string {`)
	} else {
		body.push(`export function render${component.name}(${paramFirst}`)
		body.push(...paramLines.slice(1), '): string {')
	}
	for (const stmt of component.setup) body.push(reindent(stmt, 1))
	body.push('\tconst __html: string[] = []')
	body.push(`\t__html.push(${pushArgument(rootParts)})`)
	body.push(...lines)
	body.push(`\t__html.push('</${component.tag}>')`)
	body.push("\treturn __html.join('')")
	body.push('}')

	return { code: `${body.join('\n')}\n`, runtimeImports: used }
}
