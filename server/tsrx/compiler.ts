/**
 * TSRX compiler front end — the ONE module importing `@tsrx/core` VALUES
 * (pinned 0.1.60, ADR 0023 sub-design 2; siblings may still import its
 * TYPES, e.g. `TsrxNode`, which erase at compile time and carry no pin
 * footprint). Everything downstream consumes the component IR produced
 * here; a pin upgrade touches only this file and core-shim.d.ts.
 *
 * Owns parsing (`compileSource`: locate the exported component function
 * whose body is an `@{ }` statement container, slice setup statements,
 * params, and type declarations verbatim) and the IR type vocabulary
 * (`TemplateNode`, `AttributeIR`, `ComponentIR`, …) shared by the rest of
 * the compiler. Template lowering lives in `lower-template.ts`, attribute
 * classification in `classify-attributes.ts`, signal type inference in
 * `infer-type.ts`, `export const config` extraction and compose-import
 * resolution in `config.ts`, and shared AST predicates/vocabulary constants
 * in `ast-utils.ts` — this file wires them together.
 */

import {
	getStyleElementStylesheet,
	isStyleElement,
	isTemplateForOfNode,
	isVoidElement,
	parseModule,
	type TsrxNode,
} from '@tsrx/core'
import {
	asArray,
	CLIENT_ONLY_PRIMITIVES,
	CONTEXT_NAMES,
	collectBoundNames,
	freeIdentifiers,
	identifierName,
	isNode,
	JS_GLOBALS,
	PARSER_FACTORIES,
	SIGNAL_CONSTRUCTORS,
	text,
} from './ast-utils'
import { parseComposeImports, readConfig } from './config'
import { dedentCss } from './css'
import { type CompileDiagnostic, diagnostic } from './diagnostics'
import { inferType, type TypeContext } from './infer-type'
import { lowerChildren } from './lower-template'

/* === Types === */

/** A character range in the `.tsrx` source (LT-011 span table). */
type SourceRange = { start: number; end: number }

/** A verbatim setup/side-effect statement, with its source range for LT-011. */
type SetupStmt = { text: string; range: SourceRange }

/** Signal constructor names recognized in setup declarations. */
type SignalConstructor =
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
	| {
			/**
			 * A capitalized JSX tag bound to an `import` of another `.tsrx`
			 * module (ADR 0023 sub-design 10) — composes that component: the
			 * server splices its `render<Name>()` output inline. `source` is
			 * the import specifier resolved to a repo-relative path, used to
			 * look up the child's registry entry (name, tag, generated server
			 * module) at emit time.
			 */
			kind: 'compose'
			component: string
			source: string
			attrs: ComposeAttrIR[]
			children: TemplateNode[]
			node: TsrxNode
	  }
	| {
			/**
			 * A bare JS statement inside a control-flow branch body (e.g.
			 * `internals?.states.add('clearable')` beside a conditionally
			 * rendered element) — a client-only side effect, same free-name
			 * contract as a top-level `clientSetup` statement (host/internals/
			 * signals/globals only). The server never runs it; analyze.ts
			 * decides whether/how it can be safely guarded client-side.
			 */
			kind: 'client-stmt'
			text: string
			node: TsrxNode
	  }

/**
 * One `pass={{ prop: thunk }}` entry (ADR 0023 sub-design 10). `thunk`/
 * `thunkText` is always the getter; a `{ get, set }` descriptor additionally
 * carries `setThunk`/`setThunkText` for the write-back accessor (LT-017).
 */
export type PassEntryIR = {
	prop: string
	thunk: TsrxNode
	thunkText: string
	setThunk?: TsrxNode
	setThunkText?: string
}

export type AttributeIR =
	| { kind: 'static'; name: string; value: string | null }
	| { kind: 'server'; name: string; exprText: string; node: TsrxNode }
	| { kind: 'reactive'; name: string; thunk: TsrxNode; thunkText: string }
	| { kind: 'pass'; entries: PassEntryIR[] }
	| {
			kind: 'class-map'
			thunkText: string
			/** The arrow function node — thunkText's own source range (LT-011). */
			thunk: TsrxNode
			object: TsrxNode
	  }
	| {
			/**
			 * `style={() => ({ … })}` — an object-literal-bodied style thunk
			 * (LT-028). Lowers to one `watch(thunk, bindStyle(el, [keys]))` call
			 * against `bindStyle()`'s map-form overload (LT-029), keyed on the
			 * object's own property names (plain idents or `'--custom-prop'`
			 * string literals). Classified separately from `reactive` so it
			 * bypasses the custom-element reactive-attribute gate the same way
			 * `class-map` does.
			 */
			kind: 'style-map'
			thunkText: string
			/** The arrow function node — thunkText's own source range (LT-011). */
			thunk: TsrxNode
			object: TsrxNode
	  }
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
 * Attributes on a composed (PascalCase) element (ADR 0023 sub-design 10).
 * Every non-`ref` attribute is a **server arg** — passed verbatim into the
 * child's `render<Name>()` call regardless of value shape (a callback-typed
 * param stays a callback; it is never reinterpreted as a reactive binding).
 * `pass={{ … }}` (client props) is a distinct mechanism, not yet lowered
 * here — see the follow-up composition tasks.
 */
export type ComposeAttrIR =
	| { kind: 'ref'; name: string }
	| { kind: 'arg'; name: string; exprText: string; node: TsrxNode | null }
	| { kind: 'pass'; entries: PassEntryIR[] }

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
	 * executes them as-is against the runtime harness. Each carries its
	 * source range for the LT-011 span table.
	 */
	setup: SetupStmt[]
	/**
	 * Client-only setup side effects (LT-008): connect-time statements
	 * (`internals?.states.add('clearable')`) whose free names are all
	 * client-known. Emitted into the factory after expose(); the server never
	 * runs them — they touch APIs that don't exist render-time.
	 */
	clientSetup: SetupStmt[]
	signals: SignalIR[]
	/** `expose({...})` statement text, verbatim. */
	exposeText: string | null
	/** Source range of `exposeText` (LT-011). */
	exposeRange: SourceRange | null
	/**
	 * `expose({...})`'s argument object node (LT-019): method-producer bodies
	 * inside it (`defineMethod(() => { host.value = ''; input.value = '' })`)
	 * may close over client-only ambients — context members, refs — that the
	 * server render function never declares (the closure itself is dead code
	 * server-side, `defineMethod` is identity there and never invokes it, but
	 * the generated module still needs it to TYPE-CHECK). `emit-server.ts`
	 * uses this node to find those free names and stub them.
	 */
	exposeArgNode: TsrxNode | null
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

/**
 * Shared lowering/classification context, threaded through `compileSource`,
 * `lower-template.ts`, `classify-attributes.ts`, and `config.ts`.
 */
export type ExtractContext = {
	source: string
	diagnostics: CompileDiagnostic[]
	/** Names server-known at template evaluation time (args, setup). */
	serverKnown: Set<string>
	/**
	 * Local name → import specifier resolved to a repo-relative `.tsrx` path,
	 * for composed (PascalCase) elements (ADR 0023 sub-design 10).
	 */
	composeImports: ReadonlyMap<string, string>
	/**
	 * Setup-level `const name = init` initializers, by name — lets an event
	 * attribute reference a hoisted handler by identifier (`{onInput}`)
	 * instead of only accepting an inline function expression; the resolved
	 * initializer is treated exactly like an inline one (same handler text,
	 * so `@if` branches that share the identifier automatically agree).
	 */
	setupInits: ReadonlyMap<string, TsrxNode>
}

/* === Internal Functions === */

/**
 * The doc comment immediately preceding a declaration, sliced verbatim.
 * The whitespace-only guard between comment close and declaration keeps a
 * module-level doc from being mistaken for the component's own when other
 * statements (type declarations, `declare global`) sit in between. Carried
 * above the generated `export default defineComponent(` so CEM extraction
 * (ADR 0023, LT-006) reads the authored description and tags.
 */
const leadingDocComment = (source: string, before: number): string | null => {
	const head = source.slice(0, before)
	const close = head.lastIndexOf('*/')
	if (close === -1) return null
	const open = head.lastIndexOf('/**', close)
	if (open === -1) return null
	if (head.slice(close + 2).trim() !== '') return null
	return source.slice(open, close + 2)
}

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

/* === Exported Functions === */

/**
 * Whether an AST node is a `@for` loop — a thin re-export of `@tsrx/core`'s
 * own predicate so `lower-template.ts` doesn't need its own `@tsrx/core`
 * value import (this file stays the sole one, mirroring `isVoidTag` below).
 */
export const isForOfNode = (node: TsrxNode): boolean =>
	isTemplateForOfNode(node)

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
		composeImports: new Map<string, string>(),
		setupInits: new Map<string, TsrxNode>(),
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
	ctx.composeImports = parseComposeImports(ast, filename)

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
	const setup: SetupStmt[] = []
	const clientSetup: SetupStmt[] = []
	const signals: SignalIR[] = []
	const signalByName = new Map<string, SignalIR>()
	const setupInits = new Map<string, TsrxNode>()
	let exposeText: string | null = null
	let exposeRange: SourceRange | null = null
	let exposeArgNode: TsrxNode | null = null
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
			setup.push({
				text: text(ctx.source, stmt),
				range: {
					start: typeof stmt.start === 'number' ? stmt.start : 0,
					end: typeof stmt.end === 'number' ? stmt.end : 0,
				},
			})
			const calleeName = identifierName(init.callee)
			if (calleeName && SIGNAL_CONSTRUCTORS.has(calleeName)) {
				const args = asArray(init.arguments)
				const signal: SignalIR = {
					name: declName,
					text: text(ctx.source, init),
					textStart: typeof init.start === 'number' ? init.start : 0,
					constructor: calleeName as SignalConstructor,
					init: args[0] ?? null,
					inferredType: inferType(args[0] ?? null, typeCtx),
				}
				signals.push(signal)
				signalByName.set(declName, signal)
			} else if (init.type === 'ConditionalExpression') {
				// A ternary between two constructor calls isn't recognized as a
				// signal at all (no single `.callee`) — diagnose it explicitly
				// rather than silently treating it as an ordinary setup const
				// (ADR 0023 sub-design 12).
				const consequentName = identifierName(
					(init.consequent as TsrxNode | undefined)?.callee,
				)
				const alternateName = identifierName(
					(init.alternate as TsrxNode | undefined)?.callee,
				)
				if (
					consequentName &&
					SIGNAL_CONSTRUCTORS.has(consequentName) &&
					alternateName &&
					SIGNAL_CONSTRUCTORS.has(alternateName)
				) {
					ctx.diagnostics.push(
						diagnostic.conditionalSignalConstructor(
							source,
							stmt.start,
							declName,
						),
					)
				}
			} else {
				// A plain setup const calling a client-only primitive directly —
				// `component.setup` is emitted verbatim into the SERVER render
				// function too, where these don't exist (ADR 0023 sub-design 12).
				const badPrimitives = [...freeIdentifiers(init)]
					.filter(n => CLIENT_ONLY_PRIMITIVES.has(n))
					.sort()
				if (badPrimitives.length > 0) {
					ctx.diagnostics.push(
						diagnostic.clientOnlySetupConst(
							source,
							stmt.start,
							declName,
							badPrimitives,
						),
					)
				}
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
			exposeText = text(ctx.source, expression as TsrxNode)
			exposeRange = {
				start:
					typeof (expression as TsrxNode).start === 'number'
						? ((expression as TsrxNode).start as number)
						: 0,
				end:
					typeof (expression as TsrxNode).end === 'number'
						? ((expression as TsrxNode).end as number)
						: 0,
			}
			setup.push({ text: exposeText, range: exposeRange })
			// prop → signal from expose({ prop: signal.get })
			const arg = asArray(expression?.arguments)[0] ?? null
			exposeArgNode = arg
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
							fallbackText: fallback ? text(ctx.source, fallback) : null,
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
				clientSetup.push({
					text: text(ctx.source, stmt),
					range: {
						start: typeof stmt.start === 'number' ? stmt.start : 0,
						end: typeof stmt.end === 'number' ? stmt.end : 0,
					},
				})
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
	ctx.setupInits = setupInits
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
			typeDecls.push(text(ctx.source, stmt))
			const declName = identifierName(stmt.declaration.id)
			if (declName === `${name}Props`) propsTypeName = declName
		}
		if (stmt.type === 'TSModuleDeclaration' && String(stmt.kind) === 'global')
			globalDecl = text(ctx.source, stmt)
	}
	// observedAttributes only fires for Parser-backed initializers — a name
	// that is not Parser-exposed would make the extension silently inert.
	if (config)
		for (const attr of config.observedAttributes) {
			if (!parserExposeProps.has(attr))
				ctx.diagnostics.push(
					diagnostic.invalidConfig(
						source,
						undefined,
						`config.observedAttributes names \`${attr}\`, which is not a Parser-exposed prop — the extension would be inert. Declare it as expose({ ${attr}: asString(…) }).`,
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
					paramsText: text(ctx.source, paramsNode),
					paramNames: [...paramNames],
					setup,
					clientSetup,
					signals,
					exposeText,
					exposeRange,
					exposeArgNode,
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

/**
 * Every composed (PascalCase) element in a component's template, for
 * cross-file resolution against the corpus-wide registry (ADR 0023
 * sub-design 10) — composed elements never carry children yet, so there is
 * nothing to recurse into below one.
 */
export const collectComposeElements = (
	component: ComponentIR,
): Array<TemplateNode & { kind: 'compose' }> => {
	const out: Array<TemplateNode & { kind: 'compose' }> = []
	const walk = (node: TemplateNode): void => {
		switch (node.kind) {
			case 'compose':
				out.push(node)
				return
			case 'element':
				for (const child of node.children) walk(child)
				return
			case 'if':
				for (const child of node.then) walk(child)
				for (const child of node.alternate) walk(child)
				return
			case 'switch':
				for (const arm of node.cases)
					for (const child of arm.children) walk(child)
				return
			case 'try':
				for (const child of node.children) walk(child)
				for (const child of node.catchChildren) walk(child)
				return
			default:
				return
		}
	}
	walk(component.root)
	for (const loop of component.fors.values()) walk(loop.output)
	return out
}
