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

import type { TsrxNode } from '@tsrx/core'
import { freeIdentifiers, JS_GLOBALS, MANAGED_TEXT_PROPS } from './ast-utils'
import {
	type AttributeIR,
	type ComponentIR,
	type ForIR,
	isVoidTag,
	type TemplateNode,
} from './compiler'
import { lineStartsInTemplate } from './indent'
import type { RegistryEntry } from './registry'
import { appendWithSpans, type SourceSpan, type SpanCursor } from './spans'

/* === Types === */

export type EmittedServerModule = {
	/** Full TypeScript source of the generated module. */
	code: string
	/** Runtime helper names the module imports. */
	runtimeImports: Set<string>
	/**
	 * Generated-file ↔ `.tsrx`-source span table (LT-011) for the verbatim
	 * setup statements re-declared in this module. The server half is not
	 * type-checked by `check:tsrx` today (TS diagnostics only arise in code
	 * that lowers into the client module), but the setup statements ARE
	 * verbatim here too, so the table is recorded for parity and future use.
	 */
	spans: SourceSpan[]
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
 * indentation, apply `level` tabs (first line included). Lines inside a
 * multi-line template literal pass through byte-identical — their leading
 * whitespace is string content, not indentation (LT-010).
 */
const reindent = (slice: string, level: number): string => {
	const lines = slice.split('\n')
	const mask = lineStartsInTemplate(lines)
	const indents = lines
		.filter(
			(line, i) =>
				line.trim().length > 0 && !mask[i] && !line.trimStart().startsWith('*'),
		)
		.map(line => line.match(/^[ \t]*/)?.[0] ?? '')
	const common = indents.length
		? (indents.reduce((min, ind) => (ind.length < min.length ? ind : min)) ??
			'')
		: ''
	const prefix = '\t'.repeat(level)
	return lines
		.map((line, i) => {
			if (mask[i]) return line
			if (line.trim().length === 0) return ''
			return (
				prefix + (line.startsWith(common) ? line.slice(common.length) : line)
			)
		})
		.join('\n')
}

/**
 * A lazy child's initial server value: a signal identifier reads `.get()`,
 * a thunk is invoked, an exposed-prop string key resolves through
 * `expose()`'s prop→signal map, anything else is the expression itself.
 * A managed form prop (`validationMessage`) renders empty — the library
 * owns its value, and empty is its connect-time state.
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
	if (expr.type === 'Literal' && typeof expr.value === 'string') {
		const propName = String(expr.value)
		if (component.exposeProps.has(propName)) {
			const signal = component.exposeProps.get(propName) as string
			return `${signal}.get()`
		}
		// A Parser-exposed prop (`asString`/`asBoolean`/…) as a string-literal
		// lazy child — `&{'label'}` — is the same general "watch this exposed
		// prop by name" mechanism `&{'validationMessage'}` already uses for
		// managed form props (`WatchHelper`'s `K extends keyof P & string`
		// overload, `src/helpers/reactive.ts`), just not form-specific: the
		// prop's server truth IS the root attribute that seeds it (DOM-is-
		// truth, ADR 0003), exactly like the host-prop-mirror ATTRIBUTE thunk
		// (`hostPropMirrorExpr`) above — same lookup, keyed by name instead of
		// an authored `() => host.<prop>` thunk.
		if (component.parserExposeProps.has(propName)) {
			const rootAttr = component.root.attrs.find(
				(a): a is Extract<AttributeIR, { kind: 'server' }> =>
					a.kind === 'server' && a.name === propName,
			)
			if (rootAttr) return rootAttr.exprText
		}
		if (component.config?.form && MANAGED_TEXT_PROPS.has(propName)) return "''"
	}
	if (expr.type === 'ArrowFunctionExpression') return `(${exprText})()`
	return exprText
}

/**
 * The server expression for a `() => host.<prop>` mirror: the parser-exposed
 * prop's value at render time IS the root attribute's server expression
 * (DOM-is-truth — the host attribute is the prop's seed, ADR 0003). Null when
 * the prop is not Parser-exposed or the root does not render its attribute.
 */
const hostPropMirrorExpr = (
	component: ComponentIR,
	thunk: TsrxNode,
): string | null => {
	const body = thunk.body
	if (!isTsrxNode(body) || body.type !== 'MemberExpression' || body.computed)
		return null
	const obj = body.object
	if (
		!isTsrxNode(obj) ||
		obj.type !== 'Identifier' ||
		String(obj.name) !== 'host'
	)
		return null
	const prop = body.property
	if (!isTsrxNode(prop) || prop.type !== 'Identifier') return null
	const propName = String(prop.name)
	if (!component.parserExposeProps.has(propName)) return null
	const rootAttr = component.root.attrs.find(
		(a): a is Extract<AttributeIR, { kind: 'server' }> =>
			a.kind === 'server' && a.name === propName,
	)
	return rootAttr ? rootAttr.exprText : null
}

const isTsrxNode = (value: unknown): value is TsrxNode =>
	!!value &&
	typeof value === 'object' &&
	typeof (value as TsrxNode).type === 'string'

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
	options: {
		runtimeImport: string
		sourcePath: string
		/**
		 * Composed (PascalCase) elements' targets, keyed by resolved `.tsrx`
		 * source path (ADR 0023 sub-design 10). A compose node whose `source`
		 * is missing here was already diagnosed as an error upstream
		 * (`index.ts`), so `emit` never needs to handle a missing entry.
		 */
		composeRegistry?: ReadonlyMap<string, RegistryEntry> | undefined
	},
): EmittedServerModule => {
	const used = new Set<string>()
	const lines: string[] = []
	/** Composed component name → generated server module specifier. */
	const composeImports = new Map<string, string>()
	// Pushes target __html normally; @try arms render into an isolated __arm
	// buffer so a mid-arm throw cannot leak partial markup into the output
	// (the catch arm renders its own fresh buffer).
	let buffer = '__html'
	// @try arms render into uniquely named buffers: a nested @try must not
	// shadow its enclosing arm's buffer (content would be lost).
	let armCounter = 0
	// Composed elements' children (LT-018) render into their own uniquely
	// named buffers, for the same reason.
	let childrenCounter = 0
	const tab = (depth: number) => '\t'.repeat(depth)
	/**
	 * Extracted reactive-list templates, one pending queue per open element:
	 * `<template>` is emitted after its container's close tag (outside the
	 * reconciled container's children — ADR 0017 removes unkeyed children).
	 */
	const templateQueue: string[][] = []

	const emit = (
		node: TemplateNode,
		scope: ReadonlySet<string>,
		depth: number,
	): void => {
		if (node.kind === 'client-stmt') {
			// Client-only side effect beside conditionally rendered markup
			// (`internals?.states.add('clearable')`) — the server never runs
			// connect-time DOM/ElementInternals APIs, so this renders nothing.
			return
		}
		if (node.kind === 'text') {
			lines.push(`${tab(depth)}${buffer}.push(${JSON.stringify(node.value)})`)
			return
		}
		if (node.kind === 'expr') {
			// The reserved `{children}` insertion point (ADR 0023 sub-design 10,
			// LT-018): a composed call already rendered this component's own
			// children into an HTML string — trusted, compiler-generated markup,
			// not user input, so it renders UNESCAPED here (analogous to the
			// MANAGED_TEXT_PROPS/host-prop-mirror special-casing above).
			if (
				!node.lazy &&
				node.expr.type === 'Identifier' &&
				node.exprText === 'children'
			) {
				lines.push(`${tab(depth)}${buffer}.push(String(children))`)
				return
			}
			used.add('esc')
			const value = node.lazy
				? lazyValueExpression(component, node.exprText, node.expr)
				: node.exprText
			lines.push(`${tab(depth)}${buffer}.push(esc(String(${value})))`)
			return
		}
		if (node.kind === 'if') {
			// The condition is server-known (validated at lowering) — the
			// render function evaluates it against the real args.
			lines.push(`${tab(depth)}if (${node.testText}) {`)
			for (const child of node.then) emit(child, scope, depth + 1)
			if (node.alternate.length > 0) {
				lines.push(`${tab(depth)}} else {`)
				for (const child of node.alternate) emit(child, scope, depth + 1)
			}
			lines.push(`${tab(depth)}}`)
			return
		}
		if (node.kind === 'switch') {
			// Arms are mutually exclusive — each case block breaks so JS
			// fall-through cannot blend arms.
			lines.push(`${tab(depth)}switch (${node.discriminantText}) {`)
			for (const arm of node.cases) {
				lines.push(
					`${tab(depth + 1)}${arm.testText === null ? 'default' : `case ${arm.testText}`}: {`,
				)
				for (const child of arm.children) emit(child, scope, depth + 2)
				lines.push(`${tab(depth + 2)}break`)
				lines.push(`${tab(depth + 1)}}`)
			}
			lines.push(`${tab(depth)}}`)
			return
		}
		if (node.kind === 'try' && node.pendingChildren !== null) {
			// Async boundary (ADR 0023 sub-design 13, LT-012): all three arms
			// render UNCONDITIONALLY (analyzeClient already proved each is a
			// single root element and found the guarded signal — errors would
			// have failed the build before emitServerModule runs), each
			// `hidden` unless it's the arm that won at render time. The
			// client's later `watch(signal, { ok, err, nil })` flips the same
			// `hidden` property going forward — no separate client rendering
			// path, no divergent markup.
			used.add('isPending')
			const asyncId = ++armCounter
			const stateVar = `__async${asyncId}`
			const errVar = `__async${asyncId}Err`
			const okRoot = node.children.find(
				(c): c is ElementNode => c.kind === 'element',
			) as ElementNode
			const pendingRoot = node.pendingChildren.find(
				(c): c is ElementNode => c.kind === 'element',
			) as ElementNode
			const errRoot = node.catchChildren.find(
				(c): c is ElementNode => c.kind === 'element',
			) as ElementNode
			const signalChild = okRoot.children.find(
				(c): c is TemplateNode & { kind: 'expr' } =>
					c.kind === 'expr' && c.lazy && c.expr.type === 'Identifier',
			)
			const signalName = signalChild
				? String((signalChild.expr as TsrxNode).name)
				: ''
			const errChild = errRoot.children.find(
				(c): c is TemplateNode & { kind: 'expr' } =>
					c.kind === 'expr' && c.lazy,
			)
			lines.push(
				`${tab(depth)}let ${stateVar}: 'pending' | 'ok' | 'err' = 'pending'`,
			)
			lines.push(`${tab(depth)}let ${errVar}: unknown = undefined`)
			lines.push(`${tab(depth)}if (!isPending(${signalName})) {`)
			lines.push(`${tab(depth + 1)}try {`)
			lines.push(`${tab(depth + 2)}${signalName}.get()`)
			lines.push(`${tab(depth + 2)}${stateVar} = 'ok'`)
			lines.push(`${tab(depth + 1)}} catch (e) {`)
			lines.push(`${tab(depth + 2)}${errVar} = e`)
			lines.push(`${tab(depth + 2)}${stateVar} = 'err'`)
			lines.push(`${tab(depth + 1)}}`)
			lines.push(`${tab(depth)}}`)
			const hiddenAttr = (cond: string): AttributeIR => ({
				kind: 'server',
				name: 'hidden',
				exprText: cond,
				node: node.node,
			})
			// The ok/err arms' own recognized lazy child (the guarded signal;
			// the catch param or a member read over it) must NOT evaluate its
			// real expression except in the arm that actually won: `data.get()`
			// throws while pending, and the catch param is `undefined` outside
			// the err arm. Emitting it unconditionally (the generic `emit()`
			// walker's usual behavior) would crash rendering the OTHER two
			// arms' hidden copies — guard each with the same tri-state var, and
			// let the ternary's short-circuiting keep the unsafe branch unread.
			const emitGuardedChild = (
				child: TemplateNode,
				armScope: ReadonlySet<string>,
				guardedExpr: string | null,
			): void => {
				if (guardedExpr !== null && child.kind === 'expr' && child.lazy) {
					used.add('esc')
					lines.push(`${tab(depth)}${buffer}.push(esc(String(${guardedExpr})))`)
					return
				}
				emit(child, armScope, depth)
			}
			const emitArmRoot = (
				root: ElementNode,
				armScope: ReadonlySet<string>,
				hiddenCond: string,
				guardedExpr: string | null,
			): void => {
				emitElement(root, armScope, depth, [hiddenAttr(hiddenCond)])
				for (const child of root.children)
					emitGuardedChild(child, armScope, guardedExpr)
				if (!isVoidTag(root.tag))
					lines.push(`${tab(depth)}${buffer}.push('</${root.tag}>')`)
			}
			emitArmRoot(pendingRoot, scope, `${stateVar} !== 'pending'`, null)
			emitArmRoot(
				okRoot,
				scope,
				`${stateVar} !== 'ok'`,
				`${stateVar} === 'ok' ? ${signalName}.get() : ''`,
			)
			const errScope = new Set(scope)
			if (node.catchParam) {
				lines.push(`${tab(depth)}const ${node.catchParam} = ${errVar}`)
				errScope.add(node.catchParam)
			}
			emitArmRoot(
				errRoot,
				errScope,
				`${stateVar} !== 'err'`,
				errChild ? `${stateVar} === 'err' ? (${errChild.exprText}) : ''` : null,
			)
			return
		}
		if (node.kind === 'try') {
			// Render-time error boundary. Arms render into an isolated
			// buffer so a throw mid-arm (after partial pushes) cannot leak
			// markup into the output — the catch arm starts fresh. The join
			// targets the OUTER buffer; arm names are unique so a nested @try
			// contributes through its own buffer, never shadowing.
			const armName = `__arm${++armCounter}`
			lines.push(`${tab(depth)}try {`)
			lines.push(`${tab(depth + 1)}const ${armName}: string[] = []`)
			const outerBuffer = buffer
			buffer = armName
			for (const child of node.children) emit(child, scope, depth + 1)
			buffer = outerBuffer
			lines.push(`${tab(depth + 1)}${outerBuffer}.push(${armName}.join(''))`)
			if (node.catchChildren.length > 0) {
				lines.push(
					`${tab(depth)}} catch${node.catchParam ? ` (${node.catchParam})` : ''} {`,
				)
				const catchName = `__arm${++armCounter}`
				lines.push(`${tab(depth + 1)}const ${catchName}: string[] = []`)
				buffer = catchName
				const catchScope = new Set(scope)
				if (node.catchParam) catchScope.add(node.catchParam)
				for (const child of node.catchChildren)
					emit(child, catchScope, depth + 1)
				buffer = outerBuffer
				lines.push(
					`${tab(depth + 1)}${outerBuffer}.push(${catchName}.join(''))`,
				)
			}
			lines.push(`${tab(depth)}}`)
			return
		}
		if (node.kind === 'compose') {
			// Composed elements never had their diagnostics escalate to an
			// error (index.ts validates every `node.source` against
			// composeRegistry before emitServerModule runs at all).
			const entry = options.composeRegistry?.get(node.source)
			if (!entry) return
			composeImports.set(entry.name, `./${entry.tag}.server`)
			const args = node.attrs
				.filter(
					(a): a is Extract<typeof a, { kind: 'arg' }> => a.kind === 'arg',
				)
				.map(a => `${JSON.stringify(a.name)}: ${a.exprText}`)
			// A composed element's children (LT-018) render into their own
			// buffer, once, server-side — the joined string is forwarded as
			// the child's `children` server arg (self-closing tags pass none,
			// matching "no children supplied" at the type level).
			if (node.children.length > 0) {
				const childrenVar = `__children${++childrenCounter}`
				lines.push(`${tab(depth)}const ${childrenVar}: string[] = []`)
				const outerBuffer = buffer
				buffer = childrenVar
				for (const child of node.children) emit(child, scope, depth)
				buffer = outerBuffer
				args.push(`children: ${childrenVar}.join('')`)
			}
			lines.push(
				`${tab(depth)}${buffer}.push(render${entry.name}({ ${args.join(', ')} }))`,
			)
			return
		}
		const loop = [...component.fors.values()].find(f => f.output === node)
		if (loop) {
			emitFor(loop, scope, depth)
			return
		}
		// Reactive-for templates flush after this element's close tag — the
		// spec shape (adopted items, </container>, then <template>) keeps the
		// template out of the reconciled container's children.
		templateQueue.push([])
		emitElement(node, scope, depth)
		// html={dataRef} renders as sanitized raw children before authored
		// children (dependency-provable, else omitted for the client pass).
		const htmlAttr = node.attrs.find(a => a.kind === 'html') as
			| Extract<AttributeIR, { kind: 'html' }>
			| undefined
		if (htmlAttr && dependenciesOf(htmlAttr.node).isSubsetOf(scope)) {
			used.add('sanitizeHtml')
			lines.push(
				`${tab(depth)}${buffer}.push(sanitizeHtml(String(${htmlAttr.exprText})))`,
			)
		}
		for (const child of node.children) emit(child, scope, depth)
		if (!isVoidTag(node.tag))
			lines.push(`${tab(depth)}${buffer}.push('</${node.tag}>')`)
		lines.push(...(templateQueue.pop() ?? []))
	}

	const emitElement = (
		element: ElementNode,
		scope: ReadonlySet<string>,
		depth: number,
		extraAttrs: AttributeIR[] = [],
	): void => {
		const parts: Part[] = [{ static: `<${element.tag}` }]
		let staticClass: string | null = null
		let classExpr: string | null = null
		for (const attr of [...extraAttrs, ...element.attrs]) {
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
				case 'reactive': {
					const mirror = hostPropMirrorExpr(component, attr.thunk)
					if (mirror !== null) {
						used.add('attr')
						parts.push({ expr: `attr('${attr.name}', ${mirror})` })
					} else if (dependenciesOf(attr.thunk).isSubsetOf(scope)) {
						used.add('attr')
						parts.push({ expr: `attr('${attr.name}', (${attr.thunkText})())` })
					}
					break
				}
				case 'class-map':
					if (dependenciesOf(attr.object).isSubsetOf(scope)) {
						used.add('cls')
						classExpr = `cls((${attr.thunkText})())`
					}
					break
				case 'style-map':
					if (dependenciesOf(attr.object).isSubsetOf(scope)) {
						used.add('attr')
						used.add('styleAttr')
						parts.push({
							expr: `attr('style', styleAttr((${attr.thunkText})()) || null)`,
						})
					}
					break
				case 'event':
				case 'ref':
					break
			}
		}
		if (classExpr || staticClass !== null) {
			const prefix = staticClass
				? `${escapeAttrValue(staticClass)}${classExpr ? ' ' : ''}`
				: ''
			if (classExpr) {
				parts.push({ static: ` class="${prefix}` })
				parts.push({ expr: classExpr })
				parts.push({ static: '"' })
			} else {
				parts.push({ static: ` class="${prefix}"` })
			}
		}
		parts.push({ static: '>' })
		lines.push(`${tab(depth)}${buffer}.push(${pushArgument(parts)})`)
	}

	const emitFor = (
		loop: ForIR,
		scope: ReadonlySet<string>,
		depth: number,
	): void => {
		if (loop.listSignal) {
			emitListFor(loop, scope, depth)
			return
		}
		const bodyText = [
			...loop.hoisted.map(h => h.initText),
			...loop.output.attrs.map(a =>
				'thunkText' in a ? a.thunkText : 'exprText' in a ? a.exprText : '',
			),
			...loop.output.children.map(c => ('exprText' in c ? c.exprText : '')),
		].join(' ')
		const usesIndex =
			loop.indexName !== null &&
			new RegExp(`\\b${loop.indexName}\\b`).test(bodyText)
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
			lines.push(`${tab(depth + 1)}${buffer}.push('</${loop.output.tag}>')`)
		lines.push(`${tab(depth)}}`)
	}

	/**
	 * Reactive `@for` over a declared List (ADR 0023 sub-design 5): initial
	 * keyed items render in place (adopted children are complete — values, no
	 * slot markers) with `data-key` from the shim's cause-effect-parity key
	 * generation, and the item shape is extracted as a sibling `<template>`
	 * whose `&{item}` hole becomes a `<slot>` marker. `validateListBody`
	 * (compiler) already proved the body is statics + events + the one hole.
	 */
	const emitListFor = (
		loop: ForIR,
		scope: ReadonlySet<string>,
		depth: number,
	): void => {
		const keyVar = loop.keyName ?? '__key'
		const loopScope = new Set(scope)
		loopScope.add(loop.itemName)
		if (loop.keyName) loopScope.add(keyVar)
		lines.push(
			`${tab(depth)}for (const [${keyVar}, ${loop.itemName}] of ${loop.listSignal}.entries()) {`,
		)
		const dataKey: AttributeIR = {
			kind: 'server',
			name: 'data-key',
			exprText: keyVar,
			node: loop.node,
		}
		emitElement(loop.output, loopScope, depth + 1, [dataKey])
		for (const child of loop.output.children) emit(child, loopScope, depth + 1)
		if (!isVoidTag(loop.output.tag))
			lines.push(`${tab(depth + 1)}${buffer}.push('</${loop.output.tag}>')`)
		lines.push(`${tab(depth)}}`)

		// Extracted template → the innermost open element's pending queue
		// (flushed after that element's close tag).
		const queue = templateQueue.at(-1)
		if (queue) queue.push(...listTemplateLines(loop, depth))
	}

	/** The extracted `<template>`: statics render, the hole becomes a slot. */
	const listTemplateLines = (loop: ForIR, depth: number): string[] => {
		const out: string[] = [`${tab(depth)}${buffer}.push('<template>')`]
		const shape = (node: TemplateNode, atDepth: number): void => {
			if (node.kind === 'text') {
				out.push(`${tab(atDepth)}${buffer}.push(${JSON.stringify(node.value)})`)
				return
			}
			if (node.kind === 'expr') {
				if (
					node.lazy &&
					node.expr.type === 'Identifier' &&
					node.exprText === loop.itemName
				)
					out.push(`${tab(atDepth)}${buffer}.push('<slot></slot>')`)
				return
			}
			// Statics only — validateListBody rejected everything else, and
			// events/refs never render server-side.
			if (node.kind !== 'element') return
			const parts: Part[] = [{ static: `<${node.tag}` }]
			for (const attr of node.attrs) {
				if (attr.kind !== 'static') continue
				if (attr.value === null) parts.push({ static: ` ${attr.name}` })
				else
					parts.push({
						static: ` ${attr.name}="${escapeAttrValue(attr.value)}"`,
					})
			}
			parts.push({ static: '>' })
			out.push(`${tab(atDepth)}${buffer}.push(${pushArgument(parts)})`)
			for (const child of node.children) shape(child, atDepth)
			if (!isVoidTag(node.tag))
				out.push(`${tab(atDepth)}${buffer}.push('</${node.tag}>')`)
		}
		shape(loop.output, depth + 1)
		out.push(`${tab(depth)}${buffer}.push('</template>')`)
		return out
	}

	// Root-level reactive lists flush their template before the root close.
	templateQueue.push([])
	for (const child of component.root.children)
		emit(child, component.serverKnown, 1)
	lines.push(...(templateQueue.pop() ?? []))

	// Root element opening: only static and server-definitive attributes
	// render; reactive/event/ref constructs on the root are the client
	// analyzer's to diagnose.
	const rootParts: Part[] = [{ static: `<${component.tag}` }]
	for (const attr of component.root.attrs) {
		if (attr.kind === 'static' && attr.value !== null)
			rootParts.push({
				static: ` ${attr.name}="${escapeAttrValue(attr.value)}"`,
			})
		else if (attr.kind === 'static') rootParts.push({ static: ` ${attr.name}` })
		else if (attr.kind === 'server') {
			used.add('attr')
			rootParts.push({ expr: `attr('${attr.name}', ${attr.exprText})` })
		} else if (attr.kind === 'style-map') {
			// LT-028: the root's reactive style is the one construct the client
			// analyzer accepts (targeting `host`) — render its initial value here
			// the same way `class-map` does for descendants.
			if (dependenciesOf(attr.object).isSubsetOf(component.serverKnown)) {
				used.add('attr')
				used.add('styleAttr')
				rootParts.push({
					expr: `attr('style', styleAttr((${attr.thunkText})()) || null)`,
				})
			}
		}
	}
	rootParts.push({ static: '>' })

	for (const signal of component.signals) used.add(signal.constructor)
	if (component.exposeText) used.add('expose')
	for (const ambient of component.exposeAmbients) used.add(ambient)

	const body: string[] = [
		'/**',
		' * Generated by the Le Truc TSRX compiler (ADR 0023, milestone 1) from',
		` * ${options.sourcePath} — DO NOT EDIT.`,
		' */',
	]
	if (used.size > 0) {
		const imports = [...used].sort()
		body.push(
			`import { ${imports.join(', ')} } from '${options.runtimeImport}'`,
		)
	}
	for (const [name, specifier] of [...composeImports].sort())
		body.push(`import { render${name} } from '${specifier}'`)
	body.push('')
	for (const decl of component.typeDecls) body.push(decl, '')
	// Verbatim param slice, re-indented: first line inline in the signature,
	// continuation lines keep their relative shape.
	const paramLines = reindent(component.paramsText, 2).split('\n')
	const paramFirst = paramLines[0]?.replace(/^\t\t/, '') ?? ''
	if (paramLines.length === 1) {
		body.push(
			`export function render${component.name}(${paramFirst}): string {`,
		)
	} else {
		body.push(`export function render${component.name}(${paramFirst}`)
		body.push(...paramLines.slice(1), '): string {')
	}
	// A method-producer body inside expose() (`defineMethod(() => { host.value
	// = ''; input.value = '' })`) may close over client-only ambients — context
	// members, refs — the server render function never declares. The closure
	// is dead code server-side (`defineMethod` is identity there, never
	// invoked), but the module still needs it to TYPE-CHECK (LT-019): stub any
	// such free name as `any`, scoped to this function, so it resolves without
	// pretending it has real server behavior.
	if (component.exposeArgNode) {
		const stubNames = [...freeIdentifiers(component.exposeArgNode)]
			.filter(
				name =>
					!JS_GLOBALS.has(name) &&
					name !== 'expose' &&
					!component.serverKnown.has(name) &&
					!component.exposeAmbients.includes(name),
			)
			.sort()
		for (const name of stubNames) body.push(`\tconst ${name}: any = undefined`)
	}
	// Setup statements keep their relative shape: the shallowest continuation
	// line lands at one tab (statement depth), deeper lines keep their
	// relative indent, template-literal interiors stay byte-identical (LT-010).
	// Each statement is also verbatim source, so its span is recorded
	// (LT-011) relative to `spanLines`, offset once by `setupBaseOffset`.
	const spans: SourceSpan[] = []
	const spanCursor: SpanCursor = { offset: 0 }
	const spanLines: string[] = []
	const setupBaseOffset = body.join('\n').length + 1
	for (const stmt of component.setup)
		appendWithSpans(
			spanLines,
			stmt.text,
			1,
			[{ text: stmt.text, start: stmt.range.start }],
			spans,
			spanCursor,
		)
	for (const line of spanLines) body.push(line)
	body.push('\tconst __html: string[] = []')
	body.push(`\t__html.push(${pushArgument(rootParts)})`)
	body.push(...lines)
	body.push(`\t__html.push('</${component.tag}>')`)
	body.push("\treturn __html.join('')")
	body.push('}')

	return {
		code: `${body.join('\n')}\n`,
		runtimeImports: used,
		spans: spans.map(s => ({
			...s,
			generatedStart: s.generatedStart + setupBaseOffset,
		})),
	}
}
