/**
 * TSRX compiler front end — the ONE module importing `@tsrx/core` (pinned
 * 0.1.60, ADR 0023 sub-design 2). Everything downstream consumes the
 * component IR produced here; a pin upgrade touches only this file and
 * core-shim.d.ts.
 *
 * Responsibilities:
 * - parse a `.tsrx` module and locate the exported component function whose
 *   body is an `@{ }` statement container (`JSXCodeBlock`)
 * - slice setup statements, params, and type declarations verbatim
 * - lower the output template into a typed IR whose attribute/child
 *   classification encodes the author-declared reactivity rules: function-
 *   valued binding positions are reactive, `on*`-prefixed are events,
 *   `&{ }` marks the lazy child, everything else is server-definitive
 */

import {
	getStyleElementStylesheet,
	isStyleElement,
	isTemplateForOfNode,
	isVoidElement,
	parseModule,
	type TsrxNode,
} from '@tsrx/core'
import { dedentCss } from './css'
import { diagnostic, type CompileDiagnostic } from './diagnostics'

/* === Types === */

/** Signal constructor names recognized in setup declarations. */
export type SignalConstructor =
	| 'createCell'
	| 'createList'
	| 'createStore'
	| 'deriveCell'
	| 'deriveList'
	| 'deriveStore'

/** A signal declared in the component's setup. */
export type SignalIR = {
	name: string
	/** Declaring expression text, e.g. `createCell(start)`. */
	text: string
	constructor: SignalConstructor
	/** Initializer expression node (first call argument). */
	init: TsrxNode | null
	inferredType: 'string' | 'number' | 'boolean' | 'unknown'
}

/** Template IR — the shared input of both emitters. */
export type TemplateNode =
	| {
			kind: 'element'
			tag: string
			attrs: AttributeIR[]
			children: TemplateNode[]
			node: TsrxNode
	  }
	| { kind: 'text'; value: string }
	| {
			kind: 'expr'
			/** `{expr}` or `&{expr}` child expression. */
			expr: TsrxNode
			exprText: string
			lazy: boolean
			node: TsrxNode
	  }

export type AttributeIR =
	| { kind: 'static'; name: string; value: string | null }
	| { kind: 'server'; name: string; exprText: string; node: TsrxNode }
	| { kind: 'reactive'; name: string; thunk: TsrxNode; thunkText: string }
	| { kind: 'class-map'; thunkText: string; object: TsrxNode }
	| {
			kind: 'event'
			name: string
			event: string
			handler: TsrxNode
			handlerText: string
	  }
	| { kind: 'ref'; name: string }

/** A server-data `@for` loop (reactive lists are gated — diagnostic TSRX001). */
export type ForIR = {
	itemName: string
	indexName: string | null
	keyText: string | null
	iterableText: string
	iterableName: string | null
	/** const declarations before the output element, in order. */
	hoisted: Array<{ name: string; initText: string; node: TsrxNode }>
	output: TemplateNode & { kind: 'element' }
	node: TsrxNode
}

/** A complete component extracted from one `.tsrx` source. */
export type ComponentIR = {
	/** Function name, e.g. `BasicCounter`. */
	name: string
	/** Original source text (diagnostics compute line numbers from it). */
	source: string
	/** Custom element tag from the template root, e.g. `basic-counter`. */
	tag: string
	/** Verbatim function parameter (pattern + type annotation). */
	paramsText: string
	/** Names bound by the parameter pattern (server args). */
	paramNames: string[]
	/**
	 * All setup statements verbatim, in source order — helper consts, signal
	 * declarations, and `expose()`. The generated server render function
	 * executes them as-is against the runtime harness.
	 */
	setup: string[]
	signals: SignalIR[]
	/** `expose({...})` statement text, verbatim. */
	exposeText: string | null
	/** Prop name → signal name, from `expose({ prop: signal.get })`. */
	exposeProps: Map<string, string>
	/** Template root element IR (style block removed). */
	root: TemplateNode & { kind: 'element' }
	/** `@for` loops, keyed by their template node. */
	fors: Map<TsrxNode, ForIR>
	/** Dedented verbatim CSS ("" when no style block). */
	css: string
	/** Exported `type`/`interface` declarations, verbatim. */
	typeDecls: string[]
	/** `declare global { … }` block text, verbatim (client module only). */
	globalDecl: string | null
	/** Name of the exported `<Name>Props` type, when authored. */
	propsTypeName: string | null
	/** Names considered server-known at template evaluation time. */
	serverKnown: ReadonlySet<string>
}

export type CompileResult = {
	component: ComponentIR | null
	diagnostics: CompileDiagnostic[]
}

/* === Internal Functions === */

const SIGNAL_CTORS: ReadonlySet<string> = new Set<string>([
	'createCell',
	'createList',
	'createStore',
	'deriveCell',
	'deriveList',
	'deriveStore',
])

/**
 * JS standard globals never count against dependency provability — reading
 * `String(...)` does not make a thunk unprovable.
 */
export const JS_GLOBALS: ReadonlySet<string> = new Set<string>([
	'Array',
	'BigInt',
	'Boolean',
	'Date',
	'Error',
	'Infinity',
	'JSON',
	'Math',
	'NaN',
	'Number',
	'Object',
	'RegExp',
	'String',
	'Symbol',
	'decodeURIComponent',
	'decodeURI',
	'encodeURI',
	'encodeURIComponent',
	'globalThis',
	'isFinite',
	'isNaN',
	'parseFloat',
	'parseInt',
	'undefined',
	// DOM globals (generated handlers reference element/event types)
	'console',
	'crypto',
	'document',
	'window',
	'navigator',
	'performance',
	'CustomEvent',
	'DOMTokenList',
	'Document',
	'Element',
	'Event',
	'EventTarget',
	'FocusEvent',
	'FormData',
	'HTMLButtonElement',
	'HTMLDivElement',
	'HTMLElement',
	'HTMLFormElement',
	'HTMLInputElement',
	'HTMLSelectElement',
	'HTMLSpanElement',
	'HTMLTemplateElement',
	'HTMLTextAreaElement',
	'InputEvent',
	'Intl',
	'KeyboardEvent',
	'MouseEvent',
	'Node',
	'NodeList',
	'SubmitEvent',
	'URL',
	'URLSearchParams',
	'queueMicrotask',
	'requestAnimationFrame',
	'setInterval',
	'setTimeout',
	'structuredClone',
])

const isNode = (value: unknown): value is TsrxNode =>
	!!value &&
	typeof value === 'object' &&
	typeof (value as TsrxNode).type === 'string'

const asArray = (value: unknown): TsrxNode[] =>
	Array.isArray(value) ? (value.filter(isNode) as TsrxNode[]) : []

const identifierName = (node: unknown): string | null =>
	isNode(node) && node.type === 'Identifier' ? String(node.name) : null

/** Tag/attribute names arrive as `JSXIdentifier` nodes, not `Identifier`. */
const jsxName = (node: unknown): string | null =>
	isNode(node) &&
	(node.type === 'Identifier' || node.type === 'JSXIdentifier') &&
	typeof node.name === 'string'
		? node.name
		: null

/**
 * Collect the identifiers a node reads that are NOT bound within it — its
 * free variables. Scope-aware enough for the sanctioned shapes: function
 * params, local declarators, property keys, and non-computed member
 * properties never count as reads.
 */
export const freeIdentifiers = (node: TsrxNode): Set<string> => {
	const free = new Set<string>()
	const visit = (current: unknown, bound: ReadonlySet<string>) => {
		if (Array.isArray(current)) {
			for (const child of current) visit(child, bound)
			return
		}
		if (!isNode(current)) return
		switch (current.type) {
			case 'Identifier':
				if (!bound.has(String(current.name))) free.add(String(current.name))
				return
			case 'MemberExpression':
				visit(current.object, bound)
				if (current.computed) visit(current.property, bound)
				return
			case 'Property':
				if (current.computed) visit(current.key, bound)
				visit(current.value, bound)
				return
			case 'ArrowFunctionExpression':
			case 'FunctionExpression':
			case 'FunctionDeclaration': {
				const inner = new Set(bound)
				const paramNames = new Set<string>()
				for (const param of asArray(current.params))
					collectBoundNames(param, paramNames)
				for (const n of paramNames) inner.add(n)
				visit(current.body, inner)
				return
			}
			case 'VariableDeclarator': {
				visit(current.init, bound)
				const declared = new Set<string>()
				collectBoundNames(current.id, declared)
				visit(current.id, new Set([...bound, ...declared]))
				return
			}
			case 'BlockStatement':
			case 'Program': {
				// Statements execute in order: a declaration adds its names to
				// scope for every statement that follows it.
				const inner = new Set(bound)
				for (const stmt of asArray(current.body)) {
					if (stmt.type === 'VariableDeclaration') {
						for (const decl of asArray(stmt.declarations))
							visit(decl.init, inner)
						const declared = new Set<string>()
						for (const decl of asArray(stmt.declarations))
							collectBoundNames(decl.id, declared)
						for (const name of declared) inner.add(name)
					} else if (
						stmt.type === 'FunctionDeclaration' &&
						identifierName(stmt.id)
					) {
						inner.add(identifierName(stmt.id) as string)
						visit(stmt, inner)
					} else {
						visit(stmt, inner)
					}
				}
				return
			}
			default:
				for (const [key, value] of Object.entries(current)) {
					if (key === 'loc' || key === 'range' || key === 'parent') continue
					if (isNode(value) || Array.isArray(value)) visit(value, bound)
				}
		}
	}
	visit(node, new Set())
	return free
}

/** Names declared by a binding pattern (params, declarator ids). */
export const collectBoundNames = (pattern: unknown, into: Set<string>): void => {
	if (Array.isArray(pattern)) {
		for (const p of pattern) collectBoundNames(p, into)
		return
	}
	if (!isNode(pattern)) return
	switch (pattern.type) {
		case 'Identifier':
			into.add(String(pattern.name))
			return
		case 'AssignmentPattern':
			collectBoundNames(pattern.left, into)
			return
		case 'ObjectPattern':
			for (const prop of asArray(pattern.properties)) {
				if (prop.type === 'RestElement') collectBoundNames(prop.argument, into)
				else if (prop.type === 'Property') collectBoundNames(prop.value, into)
			}
			return
		case 'ArrayPattern':
			for (const element of asArray(pattern.elements))
				collectBoundNames(element, into)
			return
		case 'RestElement':
			collectBoundNames(pattern.argument, into)
			return
		default:
	}
}

/**
 * JSX text semantics: whitespace touching a newline boundary collapses; a
 * whitespace-only node containing a newline disappears (returns "").
 */
export const collapseJsxText = (raw: string): string => {
	if (/^[ \t]*\n/.test(raw)) raw = raw.replace(/^[ \t]*\n[ \t]*/, '')
	if (/\n[ \t]*$/.test(raw)) raw = raw.replace(/\n[ \t]*$/, '')
	if (raw.includes('\n')) raw = raw.replace(/\s*\n[ \t]*/g, ' ')
	return raw
}

const attrName = (attr: TsrxNode): string => jsxName(attr.name) ?? String(attr.name)

/** `onClick` → `click`; `onKeyup` → `keyup`. */
const eventNameFromAttr = (name: string): string => {
	const rest = name.slice(2)
	return rest.charAt(0).toLowerCase() + rest.slice(1)
}

type ExtractContext = {
	source: string
	diagnostics: CompileDiagnostic[]
}

const text = (ctx: ExtractContext, node: TsrxNode | null | undefined): string =>
	node && typeof node.start === 'number' && typeof node.end === 'number'
		? ctx.source.slice(node.start, node.end)
		: ''

type TypeContext = {
	paramsNode: TsrxNode | null
	setupInits: Map<string, TsrxNode>
}

/** Infer a signal's TS-ish value type, for parser and harvest defaults. */
const inferType = (
	init: TsrxNode | null,
	ctx: TypeContext,
	depth = 0,
): 'string' | 'number' | 'boolean' | 'unknown' => {
	if (!init || depth > 6) return 'unknown'
	switch (init.type) {
		case 'Literal': {
			const value = init.value
			if (typeof value === 'number') return 'number'
			if (typeof value === 'boolean') return 'boolean'
			if (typeof value === 'string') return 'string'
			return 'unknown'
		}
		case 'TemplateLiteral':
			return 'string'
		case 'Identifier': {
			const name = String(init.name)
			const annotation = typeAnnotationForBinding(ctx.paramsNode, name)
			if (annotation) return typeOfAnnotation(annotation)
			const setupInit = ctx.setupInits.get(name)
			if (setupInit && setupInit !== init)
				return inferType(setupInit, ctx, depth + 1)
			return 'unknown'
		}
		case 'CallExpression':
		case 'OptionalCallExpression': {
			const calleeName = identifierName(init.callee)
			if (calleeName) {
				const fn = ctx.setupInits.get(calleeName)
				if (fn && fn !== init) return returnTypeOfFunction(fn, ctx, depth + 1)
			}
			return 'unknown'
		}
		default:
			return 'unknown'
	}
}

/** Return-type heuristic for setup helper arrows (`(id) => \`panel-${id}\``). */
const returnTypeOfFunction = (
	fn: TsrxNode,
	ctx: TypeContext,
	depth: number,
): 'string' | 'number' | 'boolean' | 'unknown' => {
	if (isNode(fn.returnType)) {
		const t = typeOfAnnotation(fn.returnType as TsrxNode)
		if (t !== 'unknown') return t
	}
	const body = fn.body
	if (!isNode(body)) return 'unknown'
	if (body.type === 'BlockStatement') {
		const stmts = asArray(body.body)
		const ret = stmts.find(s => s.type === 'ReturnStatement')
		if (ret && isNode(ret.argument)) return inferType(ret.argument, ctx, depth)
		return 'unknown'
	}
	return inferType(body, ctx, depth)
}

const typeAnnotationForBinding = (
	paramsNode: TsrxNode | null,
	bindingName: string,
): TsrxNode | null => {
	if (!paramsNode || !isNode(paramsNode.typeAnnotation)) return null
	const wrapped = paramsNode.typeAnnotation as TsrxNode
	const literal =
		wrapped.type === 'TSTypeAnnotation' && isNode(wrapped.typeAnnotation)
			? (wrapped.typeAnnotation as TsrxNode)
			: wrapped
	if (literal.type !== 'TSTypeLiteral') return null
	for (const member of asArray(literal.members)) {
		if (member.type !== 'TSPropertySignature') continue
		if (
			identifierName(member.key) === bindingName &&
			isNode(member.typeAnnotation)
		)
			return member.typeAnnotation as TsrxNode
	}
	return null
}

const typeOfAnnotation = (
	annotation: TsrxNode,
): 'string' | 'number' | 'boolean' | 'unknown' => {
	const inner =
		annotation.type === 'TSTypeAnnotation' && isNode(annotation.typeAnnotation)
			? (annotation.typeAnnotation as TsrxNode)
			: annotation
	switch (inner.type) {
		case 'TSStringKeyword':
			return 'string'
		case 'TSNumberKeyword':
			return 'number'
		case 'TSBooleanKeyword':
			return 'boolean'
		default:
			return 'unknown'
	}
}

/** Classify one JSXAttribute into the attribute IR. */
const classifyAttribute = (
	ctx: ExtractContext,
	attr: TsrxNode,
): AttributeIR | { kind: 'invalid'; reason: string } => {
	const name = attrName(attr)
	const value = attr.value
	if (name === 'ref') {
		const target =
			isNode(value) && value.type === 'JSXExpressionContainer'
				? value.expression
				: value
		const refName = identifierName(target)
		if (!refName)
			return {
				kind: 'invalid',
				reason: 'ref={…} expects a bare identifier (ref={textbox}).',
			}
		return { kind: 'ref', name: refName }
	}
	if (/^on[A-Z]/.test(name)) {
		const expr =
			isNode(value) && value.type === 'JSXExpressionContainer'
				? value.expression
				: value
		if (!isNode(expr) || !/Function(Expression)?$/.test(expr.type))
			return {
				kind: 'invalid',
				reason: `Event attribute ${name}={…} must be a function.`,
			}
		return {
			kind: 'event',
			name,
			event: eventNameFromAttr(name),
			handler: expr,
			handlerText: text(ctx, expr),
		}
	}
	if (!isNode(value)) return { kind: 'static', name, value: null }
	if (value.type === 'Literal')
		return { kind: 'static', name, value: String(value.value ?? '') }
	if (value.type === 'JSXExpressionContainer') {
		const expr = value.expression
		if (!isNode(expr)) return { kind: 'static', name, value: '' }
		if (expr.type === 'ArrowFunctionExpression') {
			const body = expr.body
			if (name === 'class' && isNode(body) && body.type === 'ObjectExpression')
				return { kind: 'class-map', thunkText: text(ctx, expr), object: body }
			if (!isNode(body))
				return {
					kind: 'invalid',
					reason: `Reactive attribute ${name}={…} must be a thunk with a body (() => value).`,
				}
			return {
				kind: 'reactive',
				name,
				thunk: expr,
				thunkText: text(ctx, expr),
			}
		}
		if (expr.type === 'ObjectExpression') {
			const props = asArray(expr.properties)
			const has = (key: string) =>
				props.some(
					p => p.type === 'Property' && (identifierName(p.key) ?? '') === key,
				)
			if (has('get') && has('set'))
				return {
					kind: 'invalid',
					reason: `Mediated two-way { get, set } attribute on \`${name}\` lands with the milestone-3 client subset (pass() write-back).`,
				}
		}
		if (expr.type === 'FunctionExpression')
			return {
				kind: 'invalid',
				reason: `Attribute \`${name}\` uses an unsupported function form; write a thunk (() => value).`,
			}
		return {
			kind: 'server',
			name,
			exprText: text(ctx, expr),
			node: expr,
		}
	}
	return {
		kind: 'invalid',
		reason: `Attribute \`${name}\` uses an unsupported value form.`,
	}
}

/**
 * Lower template children into IR. `&{expr}` arrives from the parser as a
 * `JSXText("&")` node immediately preceding a `JSXExpressionContainer` —
 * the sigil is detected by that adjacency.
 */
const lowerChildren = (
	ctx: ExtractContext,
	parent: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): TemplateNode[] => {
	const out: TemplateNode[] = []
	const children =
		parent.type === 'JSXElement' || parent.type === 'JSXFragment'
			? asArray(parent.children)
			: []
	let i = 0
	while (i < children.length) {
		const child = children[i] as TsrxNode
		if (child.type === 'JSXText') {
			const next = children[i + 1] as TsrxNode | undefined
			if (child.value === '&' && next?.type === 'JSXExpressionContainer') {
				const expr = next.expression
				if (isNode(expr))
					out.push({
						kind: 'expr',
						expr,
						exprText: text(ctx, expr),
						lazy: true,
						node: next as TsrxNode,
					})
				i += 2
				continue
			}
			const collapsed = collapseJsxText(String(child.value ?? ''))
			if (collapsed) out.push({ kind: 'text', value: collapsed })
			i += 1
			continue
		}
		if (child.type === 'JSXExpressionContainer') {
			const expr = child.expression
			if (isNode(expr))
				out.push({
					kind: 'expr',
					expr,
					exprText: text(ctx, expr),
					lazy: false,
					node: child,
				})
			i += 1
			continue
		}
		if (isTemplateForOfNode(child)) {
			const lowered = lowerFor(ctx, child, signals, fors)
			if (lowered) out.push(lowered)
			i += 1
			continue
		}
		if (child.type === 'JSXStyleElement') {
			// Style blocks become placeholder elements (tag 'style'); the CSS
			// is extracted via getStyleElementStylesheet, never rendered.
			out.push({
				kind: 'element',
				tag: 'style',
				attrs: [],
				children: [],
				node: child,
			})
			i += 1
			continue
		}
		if (child.type === 'JSXElement') {
			out.push(lowerElement(ctx, child, signals, fors))
			i += 1
			continue
		}
		if (child.type === 'JSXFragment') {
			out.push(...lowerChildren(ctx, child, signals, fors))
			i += 1
			continue
		}
		i += 1
	}
	return out
}

const lowerElement = (
	ctx: ExtractContext,
	element: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): TemplateNode & { kind: 'element' } => {
	const opening = element.openingElement
	const tag = jsxName(isNode(opening) ? opening.name : null) ?? ''
	const attrs: AttributeIR[] = []
	if (isNode(opening) && Array.isArray(opening.attributes)) {
		for (const attr of asArray(opening.attributes)) {
			if (attr.type !== 'JSXAttribute') {
				ctx.diagnostics.push(
					diagnostic.unsupported(ctx.source, attr.start, 'Spread attributes'),
				)
				continue
			}
			const classified = classifyAttribute(ctx, attr)
			if ('reason' in classified) {
				ctx.diagnostics.push(
					diagnostic.invalidAttribute(
						ctx.source,
						attr.start,
						`${classified.reason} (attribute \`${attrName(attr)}\`)`,
					),
				)
				continue
			}
			attrs.push(classified)
		}
	}
	return {
		kind: 'element',
		tag,
		attrs,
		children: lowerChildren(ctx, element, signals, fors),
		node: element,
	}
}

/** Lower a `@for` loop. Reactive iterables are gated with TSRX001. */
const lowerFor = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'element' }) | null => {
	const declarations = isNode(node.left) ? asArray(node.left.declarations) : []
	const itemName =
		declarations.length === 1 ? (identifierName(declarations[0]?.id) ?? '') : ''
	if (!itemName) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@for with a destructuring loop variable',
			),
		)
		return null
	}
	if (isNode(node.empty)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(ctx.source, node.start, '@empty blocks'),
		)
		return null
	}
	const iterableName = identifierName(node.right)
	if (iterableName && signals.has(iterableName)) {
		ctx.diagnostics.push(
			diagnostic.reactiveForNotSupported(ctx.source, node.start, iterableName),
		)
		return null
	}
	const bodyStmts = isNode(node.body) ? asArray(node.body.body) : []
	const hoisted: ForIR['hoisted'] = []
	let outputNode: TsrxNode | null = null
	for (const stmt of bodyStmts) {
		if (stmt.type === 'VariableDeclaration') {
			if (stmt.kind !== 'const') {
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						stmt.start,
						'Non-const declarations inside @for bodies',
					),
				)
				continue
			}
			for (const decl of asArray(stmt.declarations)) {
				const declName = identifierName(decl.id)
				if (!declName || !isNode(decl.init)) {
					ctx.diagnostics.push(
						diagnostic.unsupported(
							ctx.source,
							stmt.start,
							'Destructuring declarations inside @for bodies',
						),
					)
					continue
				}
				hoisted.push({ name: declName, initText: text(ctx, decl.init), node: decl })
			}
			continue
		}
		if (stmt.type === 'JSXElement' && !outputNode) {
			outputNode = stmt
			continue
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				stmt.start,
				'Statements other than const declarations inside @for bodies',
			),
		)
	}
	if (!outputNode) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@for bodies must contain an output element',
			),
		)
		return null
	}
	const output = lowerElement(ctx, outputNode, signals, fors)
	if (!output.tag) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@for output must be a single element',
			),
		)
		return null
	}
	const forIR: ForIR = {
		itemName,
		indexName: identifierName(node.index),
		keyText: isNode(node.key) ? text(ctx, node.key) : null,
		iterableText: text(ctx, node.right as TsrxNode),
		iterableName,
		hoisted,
		output,
		node,
	}
	fors.set(node, forIR)
	return output
}

/* === Exported Functions === */

/**
 * Parse and extract the single exported component from a `.tsrx` source.
 * Returns `{ component: null }` with diagnostics when the source does not
 * lower cleanly; milestone gates (e.g. TSRX001) surface as warnings.
 */
export const compileSource = (
	source: string,
	filename: string,
): CompileResult => {
	const ctx: ExtractContext = { source, diagnostics: [] }
	let ast: TsrxNode
	try {
		ast = parseModule(source, filename)
	} catch (e) {
		return {
			component: null,
			diagnostics: [
				diagnostic.invalidSource(
					`Failed to parse ${filename}: ${e instanceof Error ? e.message : String(e)}`,
				),
			],
		}
	}

	// Locate the exported component function (body = JSXCodeBlock).
	let fn: TsrxNode | null = null
	for (const stmt of asArray(ast.body)) {
		const decl =
			stmt.type === 'ExportNamedDeclaration' && isNode(stmt.declaration)
				? stmt.declaration
				: stmt
		if (
			decl.type === 'FunctionDeclaration' &&
			isNode(decl.body) &&
			decl.body.type === 'JSXCodeBlock'
		) {
			if (fn) {
				ctx.diagnostics.push(
					diagnostic.invalidSource(
						`${filename}: multiple component functions per file are outside the sanctioned subset.`,
					),
				)
			} else fn = decl
		}
	}
	if (!fn) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: no exported component function with an @{ } container found.`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics }
	}

	const name = identifierName(fn.id) ?? 'Component'
	const params = asArray(fn.params)
	const paramsNode = params[0] ?? null
	if (params.length !== 1 || paramsNode?.type !== 'ObjectPattern') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the component function must take a single destructured args object.`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics }
	}
	const paramNames = new Set<string>()
	collectBoundNames(paramsNode, paramNames)

	// Setup statements: const declarations (signals vs. helpers) + expose().
	const codeBlock = fn.body as TsrxNode
	const setup: string[] = []
	const signals: SignalIR[] = []
	const signalByName = new Map<string, SignalIR>()
	const setupInits = new Map<string, TsrxNode>()
	let exposeText: string | null = null
	const exposeProps = new Map<string, string>()
	const typeCtx: TypeContext = { paramsNode, setupInits }
	for (const stmt of asArray(codeBlock.body)) {
		if (stmt.type === 'VariableDeclaration') {
			const declarations = asArray(stmt.declarations)
			const decl = declarations[0] ?? null
			const declName = identifierName(decl?.id)
			if (
				stmt.kind !== 'const' ||
				declarations.length !== 1 ||
				!declName ||
				!isNode(decl?.init)
			) {
				ctx.diagnostics.push(
					diagnostic.unsupported(
						source,
						stmt.start,
						'Setup statements other than single-const declarations',
					),
				)
				continue
			}
			const init = (decl as TsrxNode).init as TsrxNode
			setupInits.set(declName, init)
			setup.push(text(ctx, stmt))
			const calleeName = identifierName(init.callee)
			if (calleeName && SIGNAL_CTORS.has(calleeName)) {
				const args = asArray(init.arguments)
				const signal: SignalIR = {
					name: declName,
					text: text(ctx, init),
					constructor: calleeName as SignalConstructor,
					init: args[0] ?? null,
					inferredType: inferType(args[0] ?? null, typeCtx),
				}
				signals.push(signal)
				signalByName.set(declName, signal)
			}
			continue
		}
		const expression =
			stmt.type === 'ExpressionStatement'
				? (stmt.expression as TsrxNode | undefined)
				: undefined
		if (stmt.type === 'ExpressionStatement' && identifierName(expression?.callee) === 'expose') {
			exposeText = text(ctx, expression as TsrxNode)
			setup.push(exposeText)
			// prop → signal from expose({ prop: signal.get })
			const arg = asArray(expression?.arguments)[0] ?? null
			for (const prop of asArray(arg?.properties)) {
				if (prop.type !== 'Property') continue
				const propName = identifierName(prop.key)
				const value = prop.value
				if (
					propName &&
					isNode(value) &&
					value.type === 'MemberExpression' &&
					identifierName(value.property) === 'get'
				) {
					const sigName = identifierName(value.object)
					if (sigName) exposeProps.set(propName, sigName)
				}
			}
			continue
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				source,
				stmt.start,
				'Setup statements other than const declarations and expose()',
			),
		)
	}

	// Output: fragment of [root element, <style>?].
	const render = codeBlock.render as TsrxNode | undefined
	if (!render || render.type !== 'JSXFragment') {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the @{ } container's output must be a fragment (element + <style>).`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics }
	}
	const fors = new Map<TsrxNode, ForIR>()
	const lowered = lowerChildren(ctx, render, signalByName, fors)
	const root = lowered.find(
		(n): n is TemplateNode & { kind: 'element' } =>
			n.kind === 'element' && !isStyleElement(n.node),
	)
	const styleChild = lowered.find(
		(n): n is TemplateNode & { kind: 'element' } =>
			n.kind === 'element' && isStyleElement(n.node),
	)
	if (!root) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: no root element found in the @{ } output.`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics }
	}
	if (!root.tag.includes('-')) {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: the root element must be the component's custom element tag (got \`${root.tag}\`).`,
			),
		)
		return { component: null, diagnostics: ctx.diagnostics }
	}

	// CSS: verbatim, dedented (see css.ts).
	let css = ''
	if (styleChild) {
		const stylesheet = getStyleElementStylesheet(styleChild.node)
		css = dedentCss(String(stylesheet?.source ?? ''))
	} else {
		ctx.diagnostics.push(
			diagnostic.invalidSource(
				`${filename}: expected a <style> block beside the root element.`,
			),
		)
	}

	// Exported type declarations + declare global, verbatim.
	const typeDecls: string[] = []
	let globalDecl: string | null = null
	let propsTypeName: string | null = null
	for (const stmt of asArray(ast.body)) {
		if (
			stmt.type === 'ExportNamedDeclaration' &&
			isNode(stmt.declaration) &&
			(stmt.declaration.type === 'TSTypeAliasDeclaration' ||
				stmt.declaration.type === 'TSInterfaceDeclaration')
		) {
			typeDecls.push(text(ctx, stmt))
			const declName = identifierName(stmt.declaration.id)
			if (declName === `${name}Props`) propsTypeName = declName
		}
		if (stmt.type === 'TSModuleDeclaration' && String(stmt.kind) === 'global')
			globalDecl = text(ctx, stmt)
	}

	const serverKnown = new Set<string>([...paramNames])
	for (const s of signals) serverKnown.add(s.name)
	for (const n of setupInits.keys()) serverKnown.add(n)

	// A milestone gate (reactive @for) skips the whole file: rendering the
	// remaining markup without the gated construct would be silently wrong.
	const gated = ctx.diagnostics.some(d => d.code === 'TSRX001')

	return {
		component: gated
			? null
			: {
					name,
					source,
					tag: root.tag,
					paramsText: text(ctx, paramsNode),
					paramNames: [...paramNames],
					setup,
					signals,
					exposeText,
					exposeProps,
					root,
					fors,
					css,
					typeDecls,
					globalDecl,
					propsTypeName,
					serverKnown,
				},
		diagnostics: ctx.diagnostics,
	}
}

/** Whether a tag renders as void (`<input>` etc.) — no closing tag. */
export const isVoidTag = (tag: string): boolean => isVoidElement(tag)
