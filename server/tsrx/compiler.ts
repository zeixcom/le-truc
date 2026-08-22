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
import { type CompileDiagnostic, diagnostic } from './diagnostics'

/* === Types === */

/** Signal constructor names recognized in setup declarations. */
export type SignalConstructor =
	| 'createCell'
	| 'createState'
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
	/** Start offset of `text` in the source (relative spans for arg surgery). */
	textStart: number
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
	| {
			/**
			 * `@if (cond) { … } else { … }` — server-known conditional markup.
			 * The server renders the taken branch; the client addresses BOTH
			 * branch roots through a union selector (DOM-is-truth: whichever
			 * branch rendered is the element the factory finds).
			 */
			kind: 'if'
			testText: string
			test: TsrxNode
			then: TemplateNode[]
			alternate: TemplateNode[]
			node: TsrxNode
	  }
	| {
			/**
			 * `@switch (disc) { @case expr: { … } @default: { … } }` — the
			 * multi-branch sibling of `@if`: server-known discriminant, the
			 * server renders the matching arm, arms are mutually exclusive.
			 */
			kind: 'switch'
			discriminantText: string
			discriminant: TsrxNode
			cases: Array<{ testText: string | null; children: TemplateNode[] }>
			node: TsrxNode
	  }
	| {
			/**
			 * `@try { … } @catch (e) { … }` — a render-time error boundary:
			 * the server renders the body inside a real try/catch; if the
			 * body throws (a server expression over args), the catch arm
			 * renders instead. `@pending` arms are gated (async boundaries).
			 */
			kind: 'try'
			children: TemplateNode[]
			catchParam: string | null
			catchChildren: TemplateNode[]
			pendingChildren: TemplateNode[] | null
			node: TsrxNode
	  }

export type AttributeIR =
	| { kind: 'static'; name: string; value: string | null }
	| { kind: 'server'; name: string; exprText: string; node: TsrxNode }
	| { kind: 'reactive'; name: string; thunk: TsrxNode; thunkText: string }
	| { kind: 'class-map'; thunkText: string; object: TsrxNode }
	| {
			/**
			 * Dynamic rendering: `html={expr}` — the .tsrx spelling of the
			 * upstream `{html expr}` keyword (newer grammar than the pinned
			 * parser). Server-known expressions render as raw, TRUSTED HTML
			 * children (no escaping — the same trust contract as the docs
			 * pipeline's rendered markup); the reactive form lowers to an
			 * `innerHTML` property binding.
			 */
			kind: 'html'
			exprText: string
			node: TsrxNode
			reactive: boolean
	  }
	| {
			kind: 'event'
			name: string
			event: string
			handler: TsrxNode
			handlerText: string
	  }
	| { kind: 'ref'; name: string }

/**
 * A `@for` loop. Over server data (`listSignal` null) it lowers to `each()`;
 * over a declared reactive `List` (ADR 0023 sub-design 5, milestone 3) the
 * server renders initial keyed items in place plus an extracted `<template>`
 * whose item hole becomes a `<slot>` marker, and the client lowers to
 * `reconcile()` (ADR 0017).
 */
export type ForIR = {
	itemName: string
	indexName: string | null
	keyText: string | null
	/** Key binding name when the key clause is a bare identifier (`key k`). */
	keyName: string | null
	/** Declared createList signal name for reactive loops, else null. */
	listSignal: string | null
	iterableText: string
	iterableName: string | null
	/** const declarations before the output element, in order. */
	hoisted: Array<{ name: string; initText: string; node: TsrxNode }>
	output: TemplateNode & { kind: 'element' }
	node: TsrxNode
}

/**
 * Extension activation declared as `export const config = { … }` (ADR 0023
 * sub-design 8). Zero-import, statically-analyzable; the compiler validates
 * the keys and lowers them to `defineComponent`'s third argument.
 */
export type ConfigIR = {
	/** Which form-association extension leads the array (host-typing widener). */
	form: 'value' | 'checked' | null
	/** Attribute names re-parsed post-connect; must be Parser-exposed props. */
	observedAttributes: string[]
}

/** Parser factory names recognized as ambients in `expose()` initializers. */
export const PARSER_FACTORIES: ReadonlySet<string> = new Set<string>([
	'asString',
	'asInteger',
	'asNumber',
	'asBoolean',
	'asEnum',
	'asClampedInteger',
	'asJSON',
])

/** Context members usable as free names in any client code position. */
export const CONTEXT_NAMES: ReadonlySet<string> = new Set<string>([
	'host',
	'internals',
])

/** Managed form props usable as string-literal lazy children (text-bindable). */
export const MANAGED_TEXT_PROPS: ReadonlySet<string> = new Set<string>([
	'validationMessage',
])

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
	/**
	 * Client-only setup side effects (LT-008): connect-time statements
	 * (`internals?.states.add('clearable')`) whose free names are all
	 * client-known. Emitted into the factory after expose(); the server never
	 * runs them — they touch APIs that don't exist render-time.
	 */
	clientSetup: string[]
	signals: SignalIR[]
	/** `expose({...})` statement text, verbatim. */
	exposeText: string | null
	/** Prop name → signal name, from `expose({ prop: signal.get })`. */
	exposeProps: Map<string, string>
	/**
	 * Prop name → Parser factory, from `expose({ prop: asString('') })` —
	 * attribute-driven state (ADR 0003): the host attribute seeds the prop at
	 * connect; `observedAttributes` re-parses it on mutation.
	 */
	parserExposeProps: Map<
		string,
		{ parser: string; fallbackText: string | null }
	>
	/** Ambient names `expose()` uses (parser factories, `defineMethod`). */
	exposeAmbients: string[]
	/** Context members referenced from setup/expose code (`host`, `internals`). */
	contextRefs: string[]
	/** Extension activation from `export const config`, when declared. */
	config: ConfigIR | null
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
	/**
	 * Doc comment immediately above the component function, verbatim —
	 * carried above the generated `export default defineComponent(` so CEM
	 * extraction reads the authored description and tags (LT-006).
	 */
	componentDoc: string | null
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
	'createState',
	'createList',
	'createStore',
	'deriveCell',
	'deriveList',
	'deriveStore',
])

/**
 * The recognized signal-constructor names — exported for the globals.d.ts
 * coverage contract (LT-004): the ambient declarations in
 * server/tsrx/globals.d.ts must stay in lockstep with this set.
 */
export const SIGNAL_CONSTRUCTORS: ReadonlySet<string> = SIGNAL_CTORS

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

/**
 * The doc comment immediately preceding a declaration, sliced verbatim.
 * The whitespace-only guard between comment close and declaration keeps a
 * module-level doc from being mistaken for the component's own when other
 * statements (type declarations, `declare global`) sit in between. Carried
 * above the generated `export default defineComponent(` so CEM extraction
 * (ADR 0023, LT-006) reads the authored description and tags.
 */
export const leadingDocComment = (
	source: string,
	before: number,
): string | null => {
	const head = source.slice(0, before)
	const close = head.lastIndexOf('*/')
	if (close === -1) return null
	const open = head.lastIndexOf('/**', close)
	if (open === -1) return null
	if (head.slice(close + 2).trim() !== '') return null
	return source.slice(open, close + 2)
}

/** Names declared by a binding pattern (params, declarator ids). */
export const collectBoundNames = (
	pattern: unknown,
	into: Set<string>,
): void => {
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

const attrName = (attr: TsrxNode): string =>
	jsxName(attr.name) ?? String(attr.name)

/** `onClick` → `click`; `onKeyup` → `keyup`. */
const eventNameFromAttr = (name: string): string => {
	const rest = name.slice(2)
	return rest.charAt(0).toLowerCase() + rest.slice(1)
}

type ExtractContext = {
	source: string
	diagnostics: CompileDiagnostic[]
	/** Names server-known at template evaluation time (args, setup). */
	serverKnown: Set<string>
}

const text = (
	ctx: ExtractContext,
	node: TsrxNode | null | undefined,
): string =>
	node && typeof node.start === 'number' && typeof node.end === 'number'
		? ctx.source.slice(node.start, node.end)
		: ''

/**
 * When a parse fails, check the error position for signatures of the NEWER
 * TSRX grammar (statement-form `switch` in templates, the `{html …}`,
 * `{text …}`, `{ref …}` keywords, setup `await`, `component` declarations) —
 * constructs the pinned @tsrx/core 0.1.60 cannot parse at all. The hint
 * turns a bare "Unexpected token" into an actionable diagnosis (pin
 * upgrades are reviewed changes, ADR 0023 sub-design 2).
 */
const newerGrammarHint = (source: string, error: unknown): string => {
	const pos =
		error &&
		typeof error === 'object' &&
		typeof (error as { pos?: unknown }).pos === 'number'
			? (error as { pos: number }).pos
			: undefined
	const around =
		pos !== undefined ? source.slice(Math.max(0, pos - 24), pos + 48) : ''
	const signatures: Array<[RegExp, string]> = [
		[/\bswitch\b/, 'statement-form switch'],
		[/\{\s*html\b/, 'the {html expr} keyword'],
		[/\{\s*text\b/, 'the {text expr} keyword'],
		[/\{\s*ref\b/, 'the {ref value} keyword'],
		[/\bawait\b/, 'await'],
		[/^\s*component\b/, 'the component keyword'],
	]
	for (const [pattern, what] of signatures)
		if (pattern.test(around))
			return ` — ${what} is newer TSRX grammar than @tsrx/core 0.1.60 (the latest published release; the tsrx.dev docs track upstream unreleased grammar — see ADR 0023 sub-design 2)`
	return ''
}

/**
 * Validate a control-flow condition (`@if` test, `@switch` discriminant):
 * server-known at render time (args, setup consts, globals) and never a
 * signal read — the DOM keeps the initially rendered branch.
 */
const validateCondition = (
	ctx: ExtractContext,
	signals: ReadonlyMap<string, SignalIR>,
	test: TsrxNode,
	what: string,
): boolean => {
	const free = freeIdentifiers(test)
	for (const global of JS_GLOBALS) free.delete(global)
	const signalReads = [...free].filter(name => signals.has(name))
	if (signalReads.length > 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				test.start,
				`${what} reads signal(s) ${signalReads.map(n => `\`${n}\``).join(', ')} — the DOM keeps the initially rendered branch, so a signal condition would silently stop matching. Conditions must derive from args or setup consts evaluated once at render time`,
			),
		)
		return false
	}
	const unknown = [...free].filter(name => !ctx.serverKnown.has(name))
	if (unknown.length > 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				test.start,
				`${what} references non-server-known name(s) ${unknown.map(n => `\`${n}\``).join(', ')} — conditions must evaluate at render time (args and setup); client-side conditional rendering is outside the model`,
			),
		)
		return false
	}
	return true
}

/**
 * Lower an `@if` directive: the condition must be server-known at render
 * time (args, setup names, globals) — client-side conditional rendering is
 * outside the enhance-don't-render model. Branch bodies lower like any
 * children; client constructs must sit on the branch ROOT elements (the
 * analyzer union-addresses them).
 */
const lowerIf = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'if' }) | null => {
	const test = node.test
	if (!isNode(test)) return null
	if (!validateCondition(ctx, signals, test, '@if condition')) return null
	const lowerBranch = (block: unknown): TemplateNode[] =>
		lowerBodyStatements(
			ctx,
			isNode(block) && Array.isArray(block.body) ? block.body : [],
			signals,
			fors,
		)
	const then = lowerBranch(node.consequent)
	const alternate = lowerBranch(node.alternate)
	if (then.length === 0 && alternate.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@if branches must contain output elements',
			),
		)
		return null
	}
	return {
		kind: 'if',
		testText: text(ctx, test),
		test,
		then,
		alternate,
		node,
	}
}

/**
 * Lower an `@switch` directive (`@case expr: { … }` / `@default: { … }`
 * arms) — the multi-branch sibling of `@if`.
 */
const lowerSwitch = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'switch' }) | null => {
	const discriminant = node.discriminant
	if (!isNode(discriminant)) return null
	if (!validateCondition(ctx, signals, discriminant, '@switch discriminant'))
		return null
	const rawCases = Array.isArray(node.cases) ? node.cases : []
	if (rawCases.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@switch must contain at least one @case or @default arm',
			),
		)
		return null
	}
	const cases: Array<{ testText: string | null; children: TemplateNode[] }> = []
	for (const raw of rawCases as TsrxNode[]) {
		const children = lowerBodyStatements(ctx, raw.consequent, signals, fors)
		if (children.length === 0) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					raw.start ?? node.start,
					'@case/@default arms must contain output elements',
				),
			)
			return null
		}
		cases.push({
			testText: isNode(raw.test) ? text(ctx, raw.test) : null,
			children,
		})
	}
	return {
		kind: 'switch',
		discriminantText: text(ctx, discriminant),
		discriminant,
		cases,
		node,
	}
}

/**
 * Lower an `@try { … } @catch (e) { … }` error boundary: a render-time
 * boundary — the server renders the body inside a real try/catch, so a
 * throwing server expression falls back to the catch arm. `@pending` arms
 * (async boundaries) are gated until the LT-012 lowering lands
 * (deriveCell(async …) + isPending(signal) branch routing — the async data
 * itself is authorable today); `@finally` is gated outright.
 */
/**
 * Lower a control-flow branch body (a statement list): elements, text,
 * fragments, and NESTED control-flow directives — a branch body is a
 * complete output context with the same contract as `lowerChildren`;
 * anything unsupported reports a diagnostic instead of being silently
 * dropped.
 */
const lowerBodyStatements = (
	ctx: ExtractContext,
	statements: unknown,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): TemplateNode[] => {
	const body = Array.isArray(statements) ? statements : []
	const out: TemplateNode[] = []
	for (const stmt of body) {
		if (stmt.type === 'JSXElement') {
			out.push(lowerElement(ctx, stmt, signals, fors))
			continue
		}
		if (stmt.type === 'JSXText') {
			const collapsed = collapseJsxText(String(stmt.value ?? ''))
			if (collapsed) out.push({ kind: 'text', value: collapsed })
			continue
		}
		if (stmt.type === 'JSXFragment') {
			out.push(...lowerChildren(ctx, stmt, signals, fors))
			continue
		}
		if (isTemplateForOfNode(stmt)) {
			const lowered = lowerFor(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered)
			continue
		}
		if (stmt.type === 'JSXIfExpression') {
			const lowered = lowerIf(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered)
			continue
		}
		if (stmt.type === 'JSXSwitchExpression') {
			const lowered = lowerSwitch(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered)
			continue
		}
		if (stmt.type === 'JSXTryExpression') {
			const lowered = lowerTry(ctx, stmt, signals, fors)
			if (lowered) out.push(lowered)
			continue
		}
		if (stmt.type === 'JSXStyleElement') {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					stmt.start,
					'<style> blocks inside control-flow branches (styles are component-scoped)',
				),
			)
			continue
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				stmt.start,
				'Statements inside control-flow branches other than output elements and nested directives',
			),
		)
	}
	return out
}

const lowerTry = (
	ctx: ExtractContext,
	node: TsrxNode,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'try' }) | null => {
	const lowerBlock = (block: unknown): TemplateNode[] =>
		lowerBodyStatements(
			ctx,
			isNode(block) && Array.isArray(block.body) ? block.body : [],
			signals,
			fors,
		)
	if (isNode(node.pending)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.pending.start,
				'@pending arms (async boundaries) await their lowering (LT-012): deriveCell(async …, { initial }) + isPending(signal) branch routing. Async data itself is authorable today — the await lives inside the async arrow, which is legal in the sync setup. Use @try/@catch (a render-time error boundary) meanwhile',
			),
		)
		return null
	}
	if (isNode(node.finalizer)) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.finalizer.start,
				'@finally arms on template @try blocks',
			),
		)
		return null
	}
	const children = lowerBlock(node.block)
	const handler = isNode(node.handler) ? node.handler : null
	let catchParam: string | null = null
	let catchChildren: TemplateNode[] = []
	if (handler) {
		catchParam = identifierName(handler.param)
		catchChildren = lowerBlock(handler.body)
	}
	if (children.length === 0 && catchChildren.length === 0) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'@try blocks must contain output elements',
			),
		)
		return null
	}
	return {
		kind: 'try',
		children,
		catchParam,
		catchChildren,
		pendingChildren: null,
		node,
	}
}

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
	// Dynamic rendering: html={dataRef} — the .tsrx spelling of the upstream
	// {html expr} keyword (newer grammar than the pinned parser). Only data
	// references are accepted; the emitters route the value through the
	// runtime's sanitizeHtml before it reaches the output.
	if (name === 'html') {
		const expr =
			isNode(value) && value.type === 'JSXExpressionContainer'
				? value.expression
				: value
		if (!isNode(expr) || !/^(Identifier|MemberExpression)$/.test(expr.type))
			return {
				kind: 'invalid',
				reason:
					'html={…} expects a data reference (identifier or member expression) — computed markup and reactive thunks are not supported.',
			}
		return {
			kind: 'html',
			exprText: text(ctx, expr),
			node: expr,
			reactive: false,
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
			const raw = String(child.value ?? '')
			// `&{expr}` lazy child: the parser emits the sigil as a text node
			// ENDING in '&' immediately before the expression container — the
			// '&' may carry leading whitespace when formatted on its own line.
			if (next?.type === 'JSXExpressionContainer' && raw.endsWith('&')) {
				const leading = collapseJsxText(raw.slice(0, -1))
				if (leading) out.push({ kind: 'text', value: leading })
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
			const collapsed = collapseJsxText(raw)
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
		if (child.type === 'JSXIfExpression') {
			const lowered = lowerIf(ctx, child, signals, fors)
			if (lowered) out.push(lowered)
			i += 1
			continue
		}
		if (child.type === 'JSXSwitchExpression') {
			const lowered = lowerSwitch(ctx, child, signals, fors)
			if (lowered) out.push(lowered)
			i += 1
			continue
		}
		if (child.type === 'JSXTryExpression') {
			const lowered = lowerTry(ctx, child, signals, fors)
			if (lowered) out.push(lowered)
			i += 1
			continue
		}
		if (
			child.type === 'JSXForExpression' &&
			String(child.statementType) === 'ForInStatement'
		) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					child.start,
					'@for-in loops (iterating object keys) — use @for-of over an array',
				),
			)
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

/**
 * Lower a `@for` loop. Server-data iterables lower to `each()`; reactive
 * `createList` iterables to the milestone-3 reconcile lowering; other
 * reactive sources stay gated (TSRX001).
 */
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
	const iterableSignal = iterableName ? signals.get(iterableName) : undefined
	if (iterableSignal) {
		if (iterableSignal.constructor !== 'createList') {
			ctx.diagnostics.push(
				diagnostic.reactiveForNotSupported(
					ctx.source,
					node.start,
					iterableSignal.name,
				),
			)
			return null
		}
		return lowerListFor(ctx, node, itemName, iterableSignal.name, signals, fors)
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
				hoisted.push({
					name: declName,
					initText: text(ctx, decl.init),
					node: decl,
				})
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
		keyName: isNode(node.key) ? identifierName(node.key) : null,
		listSignal: null,
		iterableText: text(ctx, node.right as TsrxNode),
		iterableName,
		hoisted,
		output,
		node,
	}
	fors.set(node, forIR)
	return output
}

/**
 * Validate the reactive-list body shape (ADR 0023 sub-design 5): statics and
 * event attributes anywhere, exactly one lazy `&{item}` hole (the slot fill),
 * no dynamic attributes, refs, or non-item expressions — those need per-item
 * client bindings beyond the slot-fill contract and are gated so the emitted
 * template is provably complete.
 */
const validateListBody = (
	ctx: ExtractContext,
	output: TemplateNode & { kind: 'element' },
	itemName: string,
): void => {
	let holes = 0
	const walk = (node: TemplateNode): void => {
		if (node.kind === 'expr') {
			const isItemHole =
				node.lazy &&
				node.expr.type === 'Identifier' &&
				node.exprText === itemName
			if (isItemHole) holes++
			else if (node.lazy)
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`Lazy children inside a reactive-list @for body must be the bare item (&{${itemName}}) — the slot fill. &{${node.exprText}} needs per-item bindings outside the milestone-3 subset.`,
					),
				)
			else
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`Expressions inside a reactive-list @for body must be lazy (&{${itemName}}) — server-data interpolation {${node.exprText}} has no per-item client binding.`,
					),
				)
			return
		}
		if (node.kind !== 'element') {
			if (node.kind === 'if' || node.kind === 'switch' || node.kind === 'try')
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						'Control-flow directives (@if/@switch/@try) inside a reactive-list @for body — the extracted template is static markup',
					),
				)
			return
		}
		for (const attr of node.attrs) {
			if (attr.kind === 'event') continue
			if (attr.kind === 'static') continue
			if (attr.kind === 'ref')
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						'ref={…} inside a reactive-list @for body (per-item element refs are bindItem-scoped, not host-scoped)',
					),
				)
			else
				ctx.diagnostics.push(
					diagnostic.unsupported(
						ctx.source,
						node.node.start,
						`Dynamic attribute \`${'name' in attr ? attr.name : attr.kind}\` inside a reactive-list @for body — per-item attribute bindings are outside the milestone-3 subset`,
					),
				)
		}
		for (const child of node.children) walk(child)
	}
	walk(output)
	if (holes !== 1) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				output.node.start,
				`A reactive-list @for body must render the item exactly once via &{${itemName}} — that hole is the template slot the client fills (found ${holes}).`,
			),
		)
	}
}

const lowerListFor = (
	ctx: ExtractContext,
	node: TsrxNode,
	itemName: string,
	listSignal: string,
	signals: ReadonlyMap<string, SignalIR>,
	fors: Map<TsrxNode, ForIR>,
): (TemplateNode & { kind: 'element' }) | null => {
	const indexNode = isNode(node.index) ? node.index : null
	const indexName = identifierName(indexNode)
	if (indexName) {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				indexNode?.start,
				'Index bindings in a reactive-list @for — index identity does not survive keyed reconciliation',
			),
		)
		return null
	}
	let keyName: string | null = null
	if (isNode(node.key)) {
		keyName = identifierName(node.key)
		if (!keyName) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					ctx.source,
					node.key.start,
					'The key clause of a reactive-list @for must name the key binding (a bare identifier, e.g. `key k`) — it becomes reconcile() bindItem’s key parameter',
				),
			)
			return null
		}
	}
	if (itemName === 'first' || keyName === 'first' || itemName === 'element') {
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				node.start,
				'Loop variable or key binding named `first`/`element` — reserved parameters of reconcile() bindItem',
			),
		)
		return null
	}
	const bodyStmts = isNode(node.body) ? asArray(node.body.body) : []
	let outputNode: TsrxNode | null = null
	for (const stmt of bodyStmts) {
		if (stmt.type === 'JSXElement' && !outputNode) {
			outputNode = stmt
			continue
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				ctx.source,
				stmt.start,
				stmt.type === 'VariableDeclaration'
					? 'Hoisted consts inside a reactive-list @for body (derive at use sites; per-item const rebinding is outside the milestone-3 subset)'
					: 'Statements other than the output element inside a reactive-list @for body',
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
	validateListBody(ctx, output, itemName)
	const forIR: ForIR = {
		itemName,
		indexName: null,
		keyText: isNode(node.key) ? text(ctx, node.key) : null,
		keyName,
		listSignal,
		iterableText: text(ctx, node.right as TsrxNode),
		iterableName: listSignal,
		hoisted: [],
		output,
		node,
	}
	fors.set(node, forIR)
	return output
}

/**
 * Extract and validate `export const config = { … }` — extension activation
 * (ADR 0023 sub-design 8). Unknown keys, wrong value shapes, and combined
 * form variants are errors; the observedAttributes ⊆ Parser-expose check
 * happens after the setup loop (expose is parsed later in source order).
 */
const readConfig = (ctx: ExtractContext, stmt: TsrxNode): ConfigIR | null => {
	const decl =
		stmt.type === 'ExportNamedDeclaration' && isNode(stmt.declaration)
			? stmt.declaration
			: stmt
	if (decl.type !== 'VariableDeclaration' || decl.kind !== 'const') return null
	const declarator = asArray(decl.declarations)[0] ?? null
	if (identifierName(declarator?.id) !== 'config' || !isNode(declarator?.init))
		return null
	const init = declarator.init
	if (init.type !== 'ObjectExpression') {
		ctx.diagnostics.push(
			diagnostic.invalidConfig(
				ctx.source,
				decl.start,
				'`export const config` must be an object literal.',
			),
		)
		return null
	}
	const config: ConfigIR = { form: null, observedAttributes: [] }
	for (const prop of asArray(init.properties)) {
		if (prop.type !== 'Property') continue
		const key = identifierName(prop.key)
		const value = prop.value
		if (!key || !isNode(value)) continue
		if (key === 'formAssociated' || key === 'formAssociatedCheckbox') {
			if (!(value.type === 'Literal' && value.value === true)) {
				ctx.diagnostics.push(
					diagnostic.invalidConfig(
						ctx.source,
						prop.start,
						`config.${key} must be \`true\`.`,
					),
				)
				continue
			}
			if (config.form) {
				ctx.diagnostics.push(
					diagnostic.invalidConfig(
						ctx.source,
						prop.start,
						'config cannot combine formAssociated and formAssociatedCheckbox — the runtime throws ExtensionCollisionError.',
					),
				)
				continue
			}
			config.form = key === 'formAssociated' ? 'value' : 'checked'
		} else if (key === 'observedAttributes') {
			if (value.type !== 'ArrayExpression') {
				ctx.diagnostics.push(
					diagnostic.invalidConfig(
						ctx.source,
						prop.start,
						'config.observedAttributes must be an array of string literals.',
					),
				)
				continue
			}
			for (const element of asArray(value.elements)) {
				if (
					isNode(element) &&
					element.type === 'Literal' &&
					typeof element.value === 'string'
				)
					config.observedAttributes.push(String(element.value))
				else
					ctx.diagnostics.push(
						diagnostic.invalidConfig(
							ctx.source,
							isNode(element) ? element.start : value.start,
							'config.observedAttributes must contain string literals only.',
						),
					)
			}
		} else {
			ctx.diagnostics.push(
				diagnostic.invalidConfig(
					ctx.source,
					prop.start,
					`Unknown config key \`${key}\`. Known keys: formAssociated, formAssociatedCheckbox, observedAttributes.`,
				),
			)
		}
	}
	return config
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
	const ctx: ExtractContext = {
		source,
		diagnostics: [],
		serverKnown: new Set<string>(),
	}
	let ast: TsrxNode
	try {
		ast = parseModule(source, filename)
	} catch (e) {
		return {
			component: null,
			diagnostics: [
				diagnostic.invalidSource(
					`Failed to parse ${filename}: ${e instanceof Error ? e.message : String(e)}${newerGrammarHint(source, e)}`,
				),
			],
		}
	}

	// Locate the exported component function (body = JSXCodeBlock).
	let fn: TsrxNode | null = null
	let fnStmtStart = 0
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
			} else {
				fn = decl
				fnStmtStart = typeof stmt.start === 'number' ? stmt.start : 0
			}
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

	// Setup statements: const declarations (signals vs. helpers) + expose() +
	// client-only side effects.
	const codeBlock = fn.body as TsrxNode
	const setup: string[] = []
	const clientSetup: string[] = []
	const signals: SignalIR[] = []
	const signalByName = new Map<string, SignalIR>()
	const setupInits = new Map<string, TsrxNode>()
	let exposeText: string | null = null
	const exposeProps = new Map<string, string>()
	const parserExposeProps = new Map<
		string,
		{ parser: string; fallbackText: string | null }
	>()
	const exposeAmbients = new Set<string>()
	const contextRefs = new Set<string>()
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
					textStart: typeof init.start === 'number' ? init.start : 0,
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
		if (
			stmt.type === 'ExpressionStatement' &&
			identifierName(expression?.callee) === 'expose'
		) {
			exposeText = text(ctx, expression as TsrxNode)
			setup.push(exposeText)
			// prop → signal from expose({ prop: signal.get })
			const arg = asArray(expression?.arguments)[0] ?? null
			for (const name of freeIdentifiers(
				arg ??
					({ type: 'ObjectExpression', properties: [] } as unknown as TsrxNode),
			)) {
				if (CONTEXT_NAMES.has(name)) contextRefs.add(name)
			}
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
				// Parser-backed attribute-driven props and method producers:
				// the initializer is an ambient factory call, verbatim in the
				// generated client (imports) and shimmed on the server.
				if (propName && isNode(value) && value.type === 'CallExpression') {
					const callee = identifierName(value.callee)
					if (callee && PARSER_FACTORIES.has(callee)) {
						const fallback = asArray(value.arguments)[0] ?? null
						parserExposeProps.set(propName, {
							parser: callee,
							fallbackText: fallback ? text(ctx, fallback) : null,
						})
						exposeAmbients.add(callee)
					} else if (callee === 'defineMethod') {
						exposeAmbients.add(callee)
					}
				}
			}
			continue
		}
		if (stmt.type === 'ExpressionStatement' && expression) {
			// Client-only setup side effect (LT-008): connect-time statements
			// (`internals?.states.add('clearable')`) whose free names are all
			// client-known — context members, signals, expose ambients, JS
			// globals. The server never runs them: they touch connect-time
			// APIs (ElementInternals, DOM) that don't exist render-time.
			const free = freeIdentifiers(expression)
			const bad: string[] = []
			for (const name of free) {
				if (JS_GLOBALS.has(name)) continue
				if (CONTEXT_NAMES.has(name)) {
					contextRefs.add(name)
					continue
				}
				if (signalByName.has(name)) continue
				if (exposeAmbients.has(name)) continue
				bad.push(name)
			}
			if (bad.length === 0) {
				clientSetup.push(text(ctx, stmt))
				continue
			}
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				source,
				stmt.start,
				'Setup statements other than const declarations, expose(), and client-only side effects (over host/internals/signals)',
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
	// @if conditions validate against server-known names — args and setup
	// declarations, all parsed by this point.
	ctx.serverKnown = new Set<string>([...paramNames])
	for (const s of signals) ctx.serverKnown.add(s.name)
	for (const n of setupInits.keys()) ctx.serverKnown.add(n)
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
	let config: ConfigIR | null = null
	for (const stmt of asArray(ast.body)) {
		const declaredConfig = readConfig(ctx, stmt)
		if (declaredConfig) {
			config = declaredConfig
			continue
		}
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
	// observedAttributes only fires for Parser-backed initializers — a name
	// that is not Parser-exposed would make the extension silently inert.
	if (config)
		for (const attrName of config.observedAttributes) {
			if (!parserExposeProps.has(attrName))
				ctx.diagnostics.push(
					diagnostic.invalidConfig(
						source,
						undefined,
						`config.observedAttributes names \`${attrName}\`, which is not a Parser-exposed prop — the extension would be inert. Declare it as expose({ ${attrName}: asString(…) }).`,
					),
				)
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
					clientSetup,
					signals,
					exposeText,
					exposeProps,
					parserExposeProps,
					exposeAmbients: [...exposeAmbients].sort(),
					contextRefs: [...contextRefs].sort(),
					config,
					root,
					fors,
					css,
					typeDecls,
					globalDecl,
					propsTypeName,
					componentDoc: leadingDocComment(source, fnStmtStart),
					serverKnown,
				},
		diagnostics: ctx.diagnostics,
	}
}

/** Whether a tag renders as void (`<input>` etc.) — no closing tag. */
export const isVoidTag = (tag: string): boolean => isVoidElement(tag)
