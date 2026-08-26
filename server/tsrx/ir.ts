/**
 * The TSRX compiler's IR vocabulary (LT-039, regrouping move M1 of
 * LE_TRUC_COMPILER.md §7): every type the pipeline stages share — the
 * front end (`compiler.ts`) produces a `ComponentIR` of `TemplateNode`s,
 * `analyze.ts` consumes it into a `ClientPlan`, and the two emitters
 * consume both. A pure leaf: type-only imports (`TsrxNode` erases at
 * compile time and carries no pin footprint, `CompileDiagnostic` from the
 * diagnostics leaf), no runtime values, no imports of any pipeline stage —
 * so every stage can depend on this file without depending on each other.
 */

import type { TsrxNode } from '@tsrx/core'
import type { CompileDiagnostic } from './diagnostics'

/* === Types === */

/** A character range in the `.tsrx` source (LT-011 span table). */
export type SourceRange = { start: number; end: number }

/** A verbatim setup/side-effect statement, with its source range for LT-011. */
export type SetupStmt = {
	text: string
	range: SourceRange
	/** The statement's own free-name-bearing expression (LT-034 import placement). */
	node: TsrxNode
	/** Declared const name (signals, plain consts), or `null` for `expose()`. */
	name: string | null
}

/**
 * Signal constructor names recognized in setup declarations. `requestContext`
 * (LT-035, ADR 0024 sub-design 15) is signal-SHAPED downstream (`.get()`,
 * usable in reactive attrs/lazy text exactly like `createCell`/`deriveCell`)
 * but is not a real reactive primitive — it's a client-only `FactoryContext`
 * member bound to `host`, with no server behavior at all. It is recognized
 * separately from `SIGNAL_CONSTRUCTORS` (ast-utils.ts) precisely because its
 * emission differs in both generated modules; see `fallbackText` below.
 */
export type SignalConstructor =
	| 'createCell'
	| 'createState'
	| 'createList'
	| 'createStore'
	| 'deriveCell'
	| 'deriveList'
	| 'deriveStore'
	| 'createMemo'
	| 'requestContext'

/** A signal declared in the component's setup. */
export type SignalIR = {
	name: string
	/** Declaring expression text, e.g. `createCell(start)`. */
	text: string
	/** Start offset of `text` in the source (relative spans for arg surgery). */
	textStart: number
	constructor: SignalConstructor
	/**
	 * Initializer expression node: the first call argument for a real signal
	 * constructor; the FALLBACK argument (second call argument) for
	 * `requestContext` — the value the server substitutes for the whole call.
	 */
	init: TsrxNode | null
	inferredType: 'string' | 'number' | 'boolean' | 'unknown'
	/**
	 * `requestContext`-only (LT-035): the fallback argument's verbatim source
	 * text. `requestContext` itself doesn't exist server-side (no `host`, no
	 * DOM to dispatch a context-request against) — `emit-server.ts` substitutes
	 * `createCell(${fallbackText})` for the whole setup statement instead of
	 * emitting it verbatim, the one signal constructor whose server text
	 * diverges from its client text. `null` for every other signal.
	 */
	fallbackText: string | null
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
	| ({
			/**
			 * Dynamic rendering: `html={expr}` (a bare data reference) or
			 * `html={() => expr}` (LT-025, a reactive thunk) — the .tsrx
			 * spelling of the upstream `{html expr}` keyword (newer grammar
			 * than the pinned parser). `exprText`/`node` are always the VALUE
			 * expression (the thunk's body, for the reactive form) — server
			 * rendering (sanitizeHtml, ADR 0010) is identical either way,
			 * gated on `isServerEvaluable(node, scope)`. The reactive form
			 * additionally carries the whole thunk for the client's
			 * `dangerouslyBindInnerHTML` watch (never a raw `innerHTML`
			 * property binding — that would bypass the sanitizer contract).
			 */
			kind: 'html'
			exprText: string
			node: TsrxNode
	  } & (
			| { reactive: false }
			| { reactive: true; thunk: TsrxNode; thunkText: string }
	  ))
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
	/**
	 * Plain (non-signal, non-`expose()`) setup consts — a subset of `setup`,
	 * carried separately because the client factory needs to emit exactly
	 * this subset too (signals are already client-emitted via harvest;
	 * `expose()` is already client-emitted separately) — `setup` as a whole
	 * is the SERVER-only verbatim re-declaration.
	 */
	plainSetup: SetupStmt[]
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
	/**
	 * Context members referenced from setup/expose code (`host`, `internals`,
	 * and — LT-035 — `requestContext`/`provideContexts`) — flows into the
	 * generated client factory's destructured context parameter.
	 */
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
	/**
	 * Plain (non-`.tsrx`) top-level imports, placed by where their bindings
	 * are actually used (LT-034, ADR 0024 sub-design 14) — verbatim import
	 * statement text, ready to splice into the generated module(s) that need
	 * it. An import used in both is present in both arrays. `serverLocalNames`
	 * is every locally-bound name a server import resolves — `emit-server.ts`
	 * uses it to skip the `exposeArgNode` `any`-stub for a name that already
	 * has a real import (LT-019's stub predates plain-import support, when a
	 * custom Parser's factory name could never resolve server-side at all).
	 */
	imports: {
		server: string[]
		client: string[]
		serverLocalNames: ReadonlySet<string>
	}
}

/**
 * Shared lowering/classification context, threaded through `compileSource`,
 * `lower-template.ts`, `classify-attributes.ts`, and `config.ts`.
 */
export type ExtractContext = {
	source: string
	diagnostics: CompileDiagnostic[]
	/**
	 * Prop names `expose()` declares, plus the managed form props. Populated
	 * before template lowering so a string-literal child naming a prop can be
	 * diagnosed (TSRX019) — that spelling meant "watch this prop by name"
	 * only while the `&` sigil disambiguated it from ordinary text.
	 */
	exposedProps: Set<string>
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
