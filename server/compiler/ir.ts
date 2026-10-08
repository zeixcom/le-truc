/**
 * The TSRX compiler's IR vocabulary (LT-039, regrouping move M1 of
 * LE_TRUC_COMPILER.md §7): every type the pipeline stages share — the
 * front end (`compiler.ts`) produces a `ComponentIR` of `TemplateNode`s,
 * `analyze.ts` consumes it into a `ClientPlan`, and the two emitters
 * consume both. A pure leaf: type-only imports (`AstNode` erases at
 * compile time and carries no pin footprint), no runtime values, no
 * imports of any pipeline stage — so every stage can depend on this file
 * without depending on each other. Every type here is DATA: no function
 * members, no front-end mutable state (LT-244 evicted `ExtractContext` to
 * `extract-context.ts`), so a `ComponentIR` stays serializable.
 */

import type { StyleSheet } from 'lightningcss-wasm'
import type { AstNode } from './ast-node'
import type { MessageArg } from './icu/parse'
import type { Surface } from './surface'

/* === Types === */

/**
 * The parsed component stylesheet carried on `ComponentIR.sheet` (ADR 0033
 * s9, LT-268): lightningcss's parsed sheet — rules, selectors and at-rules
 * — collected READ-ONLY (returning nodes into the parser crashes on
 * `var()` inside nested rules at 1.33; the write path is LT-304's).
 */
export type ComponentSheet = StyleSheet

/**
 * A character range in the authored source (LT-011 span table; a
 * diagnostic's range before the file is named, LT-371).
 */
export type SourceRange = { start: number; end: number }

/** A verbatim setup/side-effect statement, with its source range for LT-011. */
export type SetupStmt = {
	text: string
	range: SourceRange
	/** The statement's own free-name-bearing expression (LT-034 import placement). */
	node: AstNode
	/** Declared const name (signals, plain consts), or `null` for `expose()`. */
	name: string | null
	/**
	 * Source slices for a `text` that is not one verbatim slice: a
	 * `harvest()` seed's statement, which the server emits with the marker
	 * call read through to its seed (ADR 0046 s7). Absent, the whole text
	 * maps from `range.start`.
	 */
	slices?: ReadonlyArray<{ text: string; start: number }>
}

/**
 * Signal constructor names recognized in setup declarations. `requestContext`
 * (LT-035, ADR 0024 sub-design 15) is signal-SHAPED downstream (`.get()`,
 * usable in reactive attrs/lazy text exactly like `createCell`/`deriveCell`)
 * but is not a real reactive primitive — it's a client-only `FactoryContext`
 * member bound to `host`, with no server behavior at all. It is recognized
 * separately from `SIGNAL_CONSTRUCTORS` (vocabulary.ts) precisely because its
 * emission differs in both generated modules; see `ContextSignalIR` below.
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
	| 'createSensor'
	| 'createTask'
	| 'requestContext'

/**
 * How an `expose()` initializer lands on the host, which decides whether
 * `pass()` can bind to it (LT-158, ADR 0028 sub-design 6).
 *
 * `component.ts`'s `#setAccessor` builds a **Slot** only for a MUTABLE
 * signal or a `{ get, set }` descriptor ([ADR 0004]); anything else is
 * defined with a plain getter and has no backing signal to swap. The
 * surprise is `expose({ x: sig.get })`: `sig.get` is a bare function, so it
 * is neither a signal nor a descriptor and is wrapped in `deriveCell` —
 * read-only, however mutable the signal it reads. Verified empirically
 * against the runtime, not inferred from the types.
 *
 * - `slot` — plain value, Parser, or `{ get, set }` descriptor: Slot-backed.
 * - `computed` — `sig.get`, an arrow, any function: read-only getter.
 * - `method` — `defineMethod()`: a plain member, not reactive at all.
 */
export type ExposeKind = 'slot' | 'computed' | 'method'

/** The one `expose({...})` call — four views of the same statement. */
export type ExposeStmt = {
	/** The call expression's text, verbatim. */
	text: string
	/** Source range of `text` (LT-011). */
	range: SourceRange
	/**
	 * The argument object node (LT-019): method-producer bodies inside it
	 * (`defineMethod(() => { host.value = ''; input.value = '' })`) may close
	 * over client-only ambients — context members, refs — that the server
	 * render function never declares (the closure itself is dead code
	 * server-side, `defineMethod` is identity there and never invokes it, but
	 * the generated module still needs it to TYPE-CHECK). `emit-server.ts`
	 * uses this node to find those free names and stub them.
	 */
	argNode: AstNode | null
	/** Ambient names the call uses (parser factories, `defineMethod`), sorted. */
	ambients: string[]
}

/**
 * A Parser-backed `expose()` initializer, `prop: asString('')` —
 * attribute-driven state (ADR 0003): the host attribute seeds the prop at
 * connect; `observedAttributes` re-parses it on mutation.
 */
export type ParserExposeDecl = {
	parser: string
	fallbackText: string | null
	/**
	 * The fallback argument's AST, when it has one. Kept beside the text
	 * because LTC039 has to ask what the fallback READS, not just how it
	 * prints: a fallback whose expression reads the very site the arg renders
	 * into is bullet 2's sanctioned override, not a duplicated channel
	 * (LT-129).
	 */
	fallbackNode: AstNode | null
}

/** One prop `expose()` declares. */
export type ExposePropDecl = {
	/**
	 * How the initializer lands on the host (LT-158). Flows into the
	 * component's `RegistryEntry`, where a `pass={{ }}` site in ANOTHER file
	 * reads it to decide the binding's legality at compile time — the
	 * residual ADR 0028 sub-design 6 asked the registry to close.
	 */
	kind: ExposeKind
	/** The signal a `prop: signal.get` initializer reads. */
	signalName?: string
	/** The Parser factory call, for `prop: asString('')`. */
	parser?: ParserExposeDecl
	/**
	 * A plain-value initializer's AST (`count: 5`, `y: n * 2`), recorded for
	 * the host-seed fold (LT-386): `#initSignals` evaluates this expression
	 * once as the prop's client seed, so it is the prop's server truth.
	 * Recorded only for the shapes whose seed IS a plain expression — never
	 * a call (a Parser factory, or anything whose purity the fold cannot
	 * vouch for), a function or `sig.get` (computed), a `{ get }` object
	 * (a descriptor evaluates to its getter, not a value), or a bare
	 * identifier (a signal object or an aliasing const).
	 */
	initNode?: AstNode
}

/**
 * How a `first()` reference resolved against the component's own template:
 *
 * - `matched` — a raw element matched; it carries the synthetic `{kind:
 *   'ref'}` attr every query-naming consumer reads.
 * - `deferred` — the selector matched no raw element but names a
 *   custom-element tag (LT-127): resolution waits for the registry-aware
 *   second pass (`analysis/compose-refs.ts`), which raises LTC026/LTC027. A
 *   composed child's eventual DOM tag lives in another file's registry
 *   entry, so `compileSource` cannot decide it.
 * - `unmatched` — an OPTIONAL ref matched nothing (LT-123) — legitimate:
 *   the page may author that markup beside the component's own children,
 *   so the client queries the authored selector verbatim.
 * - `rejected` — the resolution raised a diagnostic (LTC026 not found,
 *   ambiguous, LT-132 duplicate).
 */
export type FirstRefStage = 'matched' | 'deferred' | 'unmatched' | 'rejected'

/**
 * The declared contract of a component's `children` arg (ADR 0048 s2,
 * LT-474), read from its `Children<Roles, Model>` annotation. A role key is
 * a class, its value the expected tag (`null` when the annotation's tag is
 * not a string literal — tsc rejects those at authored typecheck, so the
 * value is documentation, not a check input).
 */
export type ChildrenContractIR = {
	roles: ReadonlyMap<string, string | null>
	/** `'any'` when the second type argument is absent (the default). */
	model: 'any' | 'non-interactive' | null
	/**
	 * A roles declaration is present but the compiler cannot read it: the
	 * `Children<…>` reference or its roles argument is an imported name or
	 * another shape it cannot see through (LTC076's posture — tsc owns what
	 * the compiler cannot read). The roles then read empty, and LTC083's
	 * copy says the declaration must be readable instead of naming a role
	 * the author may have declared (LT-474 review).
	 */
	unreadable?: boolean
}

/** One `const name = first(selector, reason?)` element reference (LT-055). */
export type FirstRefDecl = {
	name: string
	selector: string
	/**
	 * Whether the author declared it required (two literals). An OPTIONAL
	 * ref (`first('sel')`, LT-123) stays optional even when the template
	 * renders its element unconditionally: the markup can be page-authored
	 * instead of server-rendered, and a page is free to leave a child out
	 * (`basic-button.html`'s `missing-elements-test` authors a bare
	 * `<button>` with no `span.label`). So cardinality is the WEAKER of what
	 * the author declared and what the site proves — never the stronger.
	 */
	required: boolean
	/**
	 * The author's required-reason text, null for an optional ref.
	 * `analysis/naming.ts`'s `addQuery` puts it into the emitted
	 * `MissingElementError` message instead of the auto-generated one — the
	 * one part of the author's call that flows into generated code verbatim.
	 */
	reason: string | null
	stage: FirstRefStage
	/** Source range of the `first()` call's declaration, when known. */
	at: { start?: number | undefined; end?: number | undefined } | undefined
}

/** Fields every signal declaration carries, whatever its family. */
type SignalIRBase = {
	name: string
	/** Declaring expression text, e.g. `createCell(start)`. */
	text: string
	/** Start offset of `text` in the source (relative spans for arg surgery). */
	textStart: number
	inferredType: 'string' | 'number' | 'boolean' | 'unknown'
}

/**
 * A mutable signal (`createCell`/`createState`/`createList`/`createStore`):
 * `init` is the initializer, the first call argument (ADR 0040 s2).
 */
export type DeclaredSignalIR = SignalIRBase & {
	family: 'declared'
	constructor: 'createCell' | 'createState' | 'createList' | 'createStore'
	/**
	 * The initializer expression node; `null` for an argument-less call. A
	 * seed wrapped in the `harvest()` marker is the marker's own seed
	 * argument: the server reads it through as identity (ADR 0046 s7).
	 */
	init: AstNode | null
	/** A seed declared through `harvest()` (ADR 0046 s7, LT-429/LT-443). */
	harvest?: HarvestSeedIR
	/** A `createList` declaration's item type, read syntactically (ADR 0046 s7). */
	listItem?: ListItemIR
	/**
	 * The declaration reads `host`/`internals` with no server truth to fold
	 * (LT-451): not server-known, so every read of it is omitted from the
	 * server render, and the client evaluates the declaration itself after
	 * `expose()` instead of harvesting it.
	 */
	unresolvable?: true
}

/** A harvest parser the compiler infers from a field's type (ADR 0046 s7). */
export type InferredParserIR = {
	name: 'asString' | 'asNumber' | 'asBoolean'
	/**
	 * The field's type text when the parser's result must narrow to it — a
	 * string-literal union reads through `asString`, and the server rendered
	 * one of its members.
	 */
	cast: string | null
}

/**
 * A seed declared through a `harvest()` marker (ADR 0046 s7): the list
 * form, `createList(harvest(seed, { field: parser, … }), …)` (LT-429) —
 * `call` is the marker call the client splices the harvested array over,
 * `entries` the parser map's entries in source order, spliced into the
 * client as authored — and the scalar form,
 * `createState(harvest(seed, parser))` (LT-443) — the parser the client's
 * text/attribute harvest reads the signal's site through, spliced as
 * authored.
 */
export type HarvestSeedIR =
	| {
			kind: 'list'
			call: AstNode
			entries: Array<{
				field: string
				key: AstNode
				value: AstNode
				text: string
			}>
	  }
	| { kind: 'scalar'; call: AstNode; parser: AstNode; parserText: string }

/** One field of a resolved list item type (ADR 0046 s7). */
export type ListItemFieldIR = {
	name: string
	/** The field's type annotation text, as authored; `| undefined` appended for an optional field. */
	typeText: string
	/** The parser its type infers, or null (an object, a `Date`, a union, an optional field). */
	parser: InferredParserIR | null
}

/**
 * A `createList` item type, resolved without a type checker (ADR 0046 s7):
 * the declaring call's first type argument, else the element type of the
 * seed arg's annotation, followed through a same-file `type` alias or an
 * `interface` without `extends`.
 *
 * - `scalar` — a `string`/`number`/`boolean` item, harvested whole from the
 *   item's bare `{item}` hole;
 * - `fields` — an object type whose fields the compiler can list;
 * - `opaque` — a type it cannot read (imported, generic, a union): only a
 *   `harvest()` map can list its fields;
 * - `unknown` — no type argument and no annotation to read.
 */
export type ListItemIR = {
	/** The item type's text; null for `unknown`. */
	typeText: string | null
	shape:
		| { kind: 'scalar' }
		| { kind: 'fields'; fields: ListItemFieldIR[] }
		| { kind: 'opaque' }
		| { kind: 'unknown' }
	/** The field `keyConfig` returns verbatim (`item => item.id`), if any. */
	keyField: string | null
}

/**
 * A derived signal (`deriveCell`/`deriveList`/`deriveStore`/`createMemo`),
 * a read-only `createSensor` (ADR 0046 s5), or an explicit `createTask`
 * — the same runtime primitive `deriveCell` builds for an async compute,
 * declared directly (LT-449). `init` is the derive
 * expression — the compute callback, or the source signal a
 * `deriveList`/`deriveStore` maps over (ADR 0040 s2); a sensor's is its
 * start callback, and its server value is the `{ value }` seed.
 */
export type DerivedSignalIR = SignalIRBase & {
	family: 'derived'
	constructor:
		| 'deriveCell'
		| 'deriveList'
		| 'deriveStore'
		| 'createMemo'
		| 'createSensor'
		| 'createTask'
	/** The derive expression node; `null` for an argument-less call. */
	init: AstNode | null
	/**
	 * A `createSensor` with no server value — no `{ value }` seed, or one no
	 * server phase can answer (ADR 0046 s5). It is not server-known, so
	 * every read of it is omitted from the server render.
	 */
	unresolvable?: true
}

/**
 * A `requestContext` declaration (LT-035, ADR 0040 s2). It has no
 * initializer: `requestContext` itself doesn't exist server-side (no `host`,
 * no DOM to dispatch a context-request against), so `emit-server.ts`
 * substitutes `createCell(${fallbackText})` for the whole setup statement
 * instead of emitting it verbatim — the one signal whose server text
 * diverges from its client text.
 */
export type ContextSignalIR = SignalIRBase & {
	family: 'context'
	constructor: 'requestContext'
	/** The fallback argument (second call argument) — the server's value. */
	fallback: AstNode
	/** The fallback argument's verbatim source text. */
	fallbackText: string
}

/** A signal declared in the component's setup, by constructor family. */
export type SignalIR = DeclaredSignalIR | DerivedSignalIR | ContextSignalIR

/** A signal with an initializer — every family but `requestContext`. */
export type InitSignalIR = DeclaredSignalIR | DerivedSignalIR

/**
 * A template expression's reactivity class (ADR 0040 s7), decided once in
 * lowering by ADR 0024 s4's rule — a function-valued attribute is reactive,
 * a text child is reactive by what it reads (`reactivity.ts`):
 *
 * - `static` — a literal; no expression to evaluate (a `text` node, a
 *   `static` attribute);
 * - `server` — evaluated once, by the server render; no client effect;
 * - `reactive` — the client re-evaluates it in a `watch()`.
 *
 * On an attribute the variant's `kind` IS the class (`reactivity.ts`'s
 * `attributeReactivity` projects it; LT-122's `bindsProp` makes a `server`
 * attribute `reactive`, as on a text child); a text child carries it as
 * `reactivity`. Consumers read the recorded class and never re-derive it
 * from the expression.
 */
export type ReactivityClass = 'static' | 'server' | 'reactive'

/**
 * What a template expression reads (ADR 0040 s7), recorded beside its
 * class at lowering. Each list is sorted and duplicate-free.
 *
 * - `signals` — declared signals the expression references (free, not
 *   shadowed), whatever the read form (`sig.get()`, the bare identifier,
 *   inside an authored thunk);
 * - `hostProps` — non-computed `host.<prop>` reads, plus the prop an
 *   LT-122 arg-and-prop site (`bindsProp`) binds;
 * - `args` — server args (component parameters) the expression references;
 * - `bound` — names reactive by POSITION, not declaration (a `@catch`
 *   parameter, a reactive loop's item; `markPositionallyReactive`).
 *
 * Nothing else is recorded: a setup const, a loop-local or a JS global is
 * neither a client dependency nor a server hole.
 */
export type DependencyClosure = {
	signals: readonly string[]
	hostProps: readonly string[]
	args: readonly string[]
	bound: readonly string[]
}

/** Template IR — the shared input of both emitters. */
export type TemplateNode =
	| {
			kind: 'element'
			tag: string
			attrs: AttributeIR[]
			children: TemplateNode[]
			node: AstNode
	  }
	| {
			kind: 'text'
			value: string
			/**
			 * The JSXText node, when one produced this text (LT-173's
			 * LTC047 cites its offset). Absent for synthesized text.
			 */
			node?: AstNode
	  }
	| {
			kind: 'expr'
			/** `{expr}` or `&{expr}` child expression. */
			expr: AstNode
			exprText: string
			/**
			 * The child's class (ADR 0040 s7): `reactive` when it lifts into a
			 * client `watch()` (a visible signal/`host` read, an authored
			 * thunk, LT-122's `bindsProp`, or a positional read), else
			 * `server`. A `{expr}` child is never `static` — literal text is
			 * a `text` node.
			 */
			reactivity: Exclude<ReactivityClass, 'static'>
			/** What the child reads (ADR 0040 s7). */
			deps: DependencyClosure
			/**
			 * The exposed prop this server-rendered text site ALSO
			 * binds client-side (LT-122) — see the identically-named
			 * field on the `'server'` attribute kind. `reactivity` is
			 * `reactive` whenever this is set: the site needs a client
			 * effect, but its `exprText` stays the ARG so the server
			 * can still render it.
			 */
			bindsProp?: string
			node: AstNode
	  }
	| {
			/**
			 * A conditional (ADR 0043 s4: one node for server-known and reactive
			 * conditions) — `@if`/`@else` and the `.tsx` ternary/`&&`
			 * (`construct: 'if'`, arms `then` then `else`, an absent `else`
			 * branch an empty arm), `@switch`/`@case` and the `.tsx` switch IIFE
			 * (`construct: 'switch'`, one arm per case in source order).
			 *
			 * - `server` mode: the test is server-known. The server renders the
			 *   taken arm; the client addresses `@if` branch roots through a
			 *   union selector (DOM-is-truth: whichever branch rendered is the
			 *   element the factory finds).
			 * - `reactive` mode (ADR 0037): the test reads a signal. Each
			 *   non-empty arm is extracted to an inert `<template>`, the server
			 *   renders the initial winner live beside them, and the client
			 *   switches arms through `reconcile()`'s arm form.
			 *
			 * `initial` is the winner at render time, kept apart from the client
			 * thunk (`testText`, which only `emit-client` reads in reactive
			 * mode) so a template target can emit it as a backend conditional.
			 */
			kind: 'conditional'
			construct: 'if' | 'switch'
			mode: 'server' | 'reactive'
			/** The `@if` test, or the `@switch` discriminant. */
			test: AstNode
			testText: string
			arms: ArmTemplate[]
			initial: InitialWinner
			node: AstNode
	  }
	| {
			/**
			 * `@try { … } @catch (e) { … }` — a render-time error boundary:
			 * the server renders the body inside a real try/catch; if the
			 * body throws (a server expression over args), the catch arm
			 * renders instead. `@pending` arms are gated (async boundaries).
			 *
			 * `pendingChildren` is the no-value-yet pending arm (`nil` in
			 * Task-state vocabulary). The arm that won at render time renders
			 * live and every arm ships as an inert template, keyed
			 * `ok`/`nil`/`err`; the client's `reconcile()` switches them as the
			 * task settles (ADR 0037 s4). (The four-arm `stale`
			 * spelling the `.tsx` front end briefly carried was withdrawn by
			 * the owner — LT-211; a re-fetching state has no arm, only the
			 * reactive `isPending` idiom beside the boundary.)
			 */
			kind: 'try'
			children: TemplateNode[]
			catchParam: string | null
			catchChildren: TemplateNode[]
			pendingChildren: TemplateNode[] | null
			node: AstNode
	  }
	| {
			/**
			 * A capitalized JSX tag bound to an `import` of another `.tsrx`
			 * module (ADR 0024 sub-design 10) — composes that component: the
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
			node: AstNode
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
			node: AstNode
	  }

/**
 * One arm of a conditional, keyed by its compile-time name (ADR 0037 s2):
 * `then`/`else` for an `@if`, `case:<literal JSON>` for an `@case` (value
 * typed, so `case:1` and `case:"1"` stay distinct while `1` and `1.0` — the
 * same literal value, as `===` says — share one key), `default` for
 * `@default`. The server emit and the generated client derive the same key,
 * which is what lets the first `reconcile()` run adopt the server-rendered
 * winner.
 */
export type ArmTemplate = {
	key: string
	/** The `@case` test expression; null for `then`/`else`/`default`. */
	test: AstNode | null
	testText: string | null
	children: TemplateNode[]
}

/**
 * The arm a conditional renders at render time (ADR 0043 s4), one of:
 *
 * - `constant` — known at compile time: the arm key, or null for none (an
 *   unresolvable reactive condition renders no live arm, ADR 0037 s5);
 * - `select` — the first case whose `when` holds, else `otherwise`. Each
 *   `when` is a portable expression over server args (ADR 0043 s1), as
 *   source text; every key names its arm's `keyOf` — null when that arm
 *   renders nothing, exactly as the `constant` path answers (LT-386);
 * - `fold` — only the value harness can decide it: SSG folds it as before,
 *   and a template target routes the component Static.
 */
export type InitialWinner =
	| { constant: string | null }
	| {
			select: Array<{ when: string; key: string | null }>
			otherwise: string | null
	  }
	| { fold: true }

/**
 * One `pass={{ prop: thunk }}` entry (ADR 0024 sub-design 10). `thunk`/
 * `thunkText` is always the getter; a `{ get, set }` descriptor additionally
 * carries `setThunk`/`setThunkText` for the write-back accessor (LT-017).
 */
export type PassEntryIR = {
	prop: string
	thunk: AstNode
	thunkText: string
	setThunk?: AstNode
	setThunkText?: string
}

export type AttributeIR =
	| { kind: 'static'; name: string; value: string | null }
	| {
			kind: 'server'
			name: string
			exprText: string
			node: AstNode
			deps: DependencyClosure
			/**
			 * The exposed prop this server-rendered attribute ALSO binds
			 * client-side (LT-122) — set when `exprText` is a bare
			 * identifier naming both a server arg and an `expose()`d prop
			 * of the same name. The server renders the arg (unchanged);
			 * the client watches `() => host.<bindsProp>` against the same
			 * site, so one authored `{disabled}` is the render target, the
			 * harvest source, and the binding target at once.
			 */
			bindsProp?: string
	  }
	| {
			kind: 'reactive'
			name: string
			thunk: AstNode
			thunkText: string
			deps: DependencyClosure
	  }
	| { kind: 'pass'; entries: PassEntryIR[] }
	| {
			kind: 'class-map'
			thunkText: string
			/** The arrow function node — thunkText's own source range (LT-011). */
			thunk: AstNode
			object: AstNode
			deps: DependencyClosure
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
			thunk: AstNode
			object: AstNode
			deps: DependencyClosure
	  }
	| ({
			/**
			 * Dynamic rendering: `truc:html={expr}` (a bare data reference) or
			 * `truc:html={() => expr}` (LT-025, a reactive thunk) — the .tsrx
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
			node: AstNode
			/** What the value reads — the thunk's, for the reactive form. */
			deps: DependencyClosure
	  } & (
			| { reactive: false }
			| { reactive: true; thunk: AstNode; thunkText: string }
	  ))
	| {
			kind: 'event'
			name: string
			event: string
			handler: AstNode
			handlerText: string
	  }
	| {
			/**
			 * A handler arg placed on this raw element (LT-461): `onClick=
			 * {onPress}` where `onPress` is one of the component's own handler
			 * args. Neither half of the component emits it — no attribute, no
			 * listener. It records the placement the registry entry publishes
			 * (`RegistryEntry.handlerArgs`), so a composing parent binds its
			 * handler on this element. The event comes from the attribute name
			 * (`onClick` → `click`), the arg from the value.
			 */
			kind: 'handler-arg'
			name: string
			event: string
			arg: string
			node: AstNode
	  }
	| {
			/**
			 * An element bound to a name usable as a client-side reference. On
			 * a RAW (dashed-tag) element this is never authored as a JSX
			 * attribute — `classifyAttribute` hard-errors a bare `ref={}`
			 * (LTC006) — this variant is instead populated exclusively by
			 * `compiler.ts`'s post-lowering `first(selector, required)`
			 * resolution (LT-055), which structurally matches the author's
			 * selector against the template and attaches this to the matched
			 * element(s) (more than one only when they are mutually-exclusive
			 * `@if` branch roots). On a COMPOSED (PascalCase) element,
			 * `ref={name}` is still authored directly as a JSX attribute
			 * (`classifyComposeAttribute`) — `first()`'s selector-matching
			 * never sees `kind: 'compose'` nodes, so the composed half is
			 * populated by the registry-aware second pass instead (LT-127,
			 * `analysis/compose-refs.ts`) — the authoring surface is `first()`
			 * for both element kinds; `ref={}` is retired outright.
			 * Every downstream consumer (`addQuery`'s naming, `refNames`
			 * collection in `analysis/plan.ts`) is unchanged from the original
			 * `ref={}` design either way — only the raw-element authoring
			 * surface moved.
			 */
			kind: 'ref'
			name: string
			/**
			 * The author's `first()` selector (LT-316). Selector resolution
			 * emits it in place of a synthesized one whenever it is
			 * structurally verifiable (`selectorCandidates`), because
			 * page-authored occurrences are addressed by its contract.
			 */
			selector?: string
	  }

/**
 * Attributes on a composed (PascalCase) element (ADR 0024 sub-design 10).
 * Every non-`ref` attribute is a **server arg** — passed verbatim into the
 * child's `render<Name>()` call regardless of value shape (a callback-typed
 * param stays a callback; it is never reinterpreted as a reactive binding).
 * `pass={{ … }}` (client props) is a distinct mechanism, not yet lowered
 * here — see the follow-up composition tasks.
 */
export type ComposeAttrIR =
	| { kind: 'ref'; name: string }
	| { kind: 'arg'; name: string; exprText: string; node: AstNode | null }
	| { kind: 'pass'; entries: PassEntryIR[] }
	| {
			/**
			 * A handler arg at the compose site (LT-461): an attribute named
			 * `on` plus a capital letter. Never a server arg — the parent's
			 * client binds `handler` with `on()` on each element the child
			 * places the arg on (its registry entry's `handlerArgs`), the
			 * event coming from the child's placement. `forward` names the
			 * composing component's OWN handler arg when the value is that
			 * arg (`<Inner onClick={onClick} />`): the composing component
			 * emits nothing and publishes the inner placement as its own.
			 */
			kind: 'handler'
			name: string
			handler: AstNode
			handlerText: string
			forward: string | null
	  }

/** Fields every `@for` loop carries, whichever lowering it takes. */
type ForIRBase = {
	itemName: string
	output: TemplateNode & { kind: 'element' }
	node: AstNode
	/**
	 * The empty arm (LT-212; ADR 0040 s1) — `.tsrx` `@empty`, or the `.tsx`
	 * `{xs.length === 0 ? <empty/> : xs.map(…)}` idiom — rendered when the
	 * iterable is empty, kept on the toggle path out of the keyed arm space
	 * (ADR 0037 s5); `null` when the loop has none. Its roots are shared, not
	 * moved: they also sit in the template tree as `output`'s following
	 * siblings, so selector, id and prose checks cover them; the server
	 * emitter skips them in its plain walk (`emptyArmNodes`) and renders them
	 * from the loop.
	 */
	emptyArm: TemplateNode[] | null
}

/**
 * A `@for` over server data: lowers to `each()` on the client. A `key`
 * clause is a compile error here (LTC052) — keys are a reactive-List concern.
 */
export type EachForIR = ForIRBase & {
	kind: 'each'
	indexName: string | null
	iterableText: string
	/**
	 * The iterable expression node — a server-evaluated position the
	 * partial-readiness check reads (LT-313; `fold-inputs.ts`).
	 */
	iterable: AstNode
	/** The iterable when it is a bare identifier, else null. */
	iterableName: string | null
	/** const declarations before the output element, in order. */
	hoisted: Array<{ name: string; initText: string; node: AstNode }>
}

/**
 * A `@for` over a declared reactive `List` (ADR 0024 sub-design 5,
 * milestone 3): the server renders initial keyed items in place plus an
 * extracted `<template>` whose item-dependent sites bake empty, and the
 * client lowers to `reconcile()` (ADR 0017).
 */
export type ReconcileForIR = ForIRBase & {
	kind: 'reconcile'
	/** Declared createList signal name. */
	listSignal: string
	/** Verbatim key clause text, when present. */
	keyText: string | null
	/** Key binding name when the key clause is a bare identifier (`key k`). */
	keyName: string | null
	/** The item's setup statements, in source order (ADR 0046 s5). */
	setup: ItemSetupStmt[]
}

/**
 * One statement of a reactive-list item's setup (ADR 0046 s5): the block
 * body of the `.tsx` `map` callback, or the statements of a `.tsrx` `@for`
 * body, classified by the component-setup rules with the item and key as
 * known names. Every kind but `client` declares a per-item name.
 *
 * - `const` — a plain const, evaluated in both phases: per initial item in
 *   the server's loop, per entering item in `bindItem`. `server` is false
 *   for a function initializer whose body reads a client-only name: it is
 *   defined, never called, server-side, so the server leaves it out.
 * - `signal` — a signal declaration over the item: the value harness
 *   evaluates it once per initial item, the client per entering item.
 * - `ref` — `first()` against the item's own `first`; `root` when the
 *   selector names the item root itself, resolved at build time to
 *   `bindItem`'s element parameter (ADR 0046 s2).
 * - `client` — a client-only side effect (`watch`/`on`/`pass` and the
 *   like), run in `bindItem` only and disposed with the item.
 */
export type ItemSetupStmt =
	| (SetupStmt & { kind: 'const'; name: string; server: boolean })
	| (SetupStmt & {
			kind: 'signal'
			name: string
			constructor: Exclude<SignalConstructor, 'requestContext'>
	  })
	| (SetupStmt & {
			kind: 'ref'
			name: string
			selector: string
			reason: string | null
			required: boolean
			root: boolean
	  })
	| (SetupStmt & { kind: 'client'; name: null })

/** A `@for` loop, discriminated by its lowering (ADR 0040 s1). */
export type ForIR = EachForIR | ReconcileForIR

/**
 * Extension activation declared as `export const config = { … }` (ADR 0024
 * sub-design 8). Zero-import, statically-analyzable; the compiler validates
 * the keys and lowers them to `defineComponent`'s third argument.
 */
export type ConfigIR = {
	/** Which form-association extension leads the array (host-typing widener). */
	form: 'value' | 'checked' | null
	/** Attribute names re-parsed post-connect; must be Parser-exposed props. */
	observedAttributes: string[]
}

/** One top-level property of the component's parameter pattern. */
export type ComponentParam = {
	name: string
	/** Verbatim type annotation text (`'string'`, `'number | null'`, …). */
	typeText: string
	/** The pattern declares the key optional (`name?:`). */
	optional: boolean
	/** The pattern carries a default (`name = expr`). */
	hasDefault: boolean
	/** The annotation is `string` — a raw attribute value may pass for it. */
	isString: boolean
	/**
	 * The annotation is `number` — a finite numeric attribute value is
	 * converted for it (LT-095, basic-blogmeta's `reading-time`).
	 */
	isNumber: boolean
}

/** A complete component extracted from one `.tsrx` source. */
export type ComponentIR = {
	/** Function name, e.g. `BasicCounter`. */
	name: string
	/** Original source text (diagnostics compute line numbers from it). */
	source: string
	/**
	 * The authored surface (LT-233): the analysis passes word their
	 * diagnostics in its vocabulary (`surface.ts`). Nothing else may branch
	 * on it — the IR is otherwise surface-neutral (ADR 0032 s2). Optional
	 * because it is contract IR (`contract.ts`: a new field is additive
	 * only when optional): a third-party front end that omits it gets the
	 * `.tsx` wording, the JavaScript-expression spelling.
	 */
	surface?: Surface
	/** Custom element tag from the template root, e.g. `basic-counter`. */
	tag: string
	/** Verbatim function parameter (pattern + type annotation). */
	paramsText: string
	/** Names bound by the parameter pattern (server args). */
	paramNames: string[]
	/**
	 * Value names declared at module level beside the component function
	 * (`const`, `function`, `class`, exported or not). Neither generated
	 * module carries them verbatim (`i18n` and `config` are read, not
	 * copied), so a client position reading one is LTC005's server-only
	 * face (LT-348). Optional: contract IR; a front end that omits it only
	 * loses that one diagnostic.
	 */
	moduleBindings?: string[]
	/**
	 * The names the parameter pattern binds for the reserved record's `t`
	 * (`i18n: { t }`, `i18n: { t: tr }`). A static `t.<key>` read of a
	 * declared key is admitted in client positions (ADR 0030 s9, LT-218);
	 * the whole-record spelling (`i18n.t.<key>`) is not. Optional: contract
	 * IR; omitted, every `t` read in a client position stays LTC005.
	 */
	messageTBindings?: string[]
	/**
	 * The component's handler args (LT-461), binding name → arg name. A
	 * handler arg has no value in either half of the component; a read of
	 * one is LTC081's, so the server-only-name report leaves it out.
	 */
	handlerArgs?: ReadonlyMap<string, string>
	/**
	 * The names the parameter pattern binds for the reserved record ITSELF
	 * (`{ i18n }`, aliased or not) — read as `i18n.t.<key>` or
	 * `<alias>.t.<key>`. The record spelling stays server-only (ADR 0030
	 * s9), so a client position reading it is LTC005; the field routes that
	 * diagnostic to the literal-key fix rather than the generic exposed-prop
	 * one (LT-358c). Optional: contract IR; omitted, a flagged record name
	 * keeps the generic fix.
	 */
	messageRecordBindings?: string[]
	/**
	 * Per-parameter pattern facts the page-occurrence renderer needs
	 * (LT-194): one entry per top-level property, in source order. `typeText`
	 * is the verbatim type annotation; `optional`/`hasDefault` decide whether
	 * an absent attribute may omit the key; `isString` decides whether a raw
	 * attribute value may pass for a non-parser arg.
	 */
	paramProps: ComponentParam[]
	/**
	 * The component's `export const i18n` declaration (ADR 0030 sub-design
	 * 4, LT-173): message key → source-locale string, inline in the `.tsrx`.
	 * Null when the component declares none — then it has no catalog, no
	 * `t` obligation, and the untranslated-literal warning never fires.
	 */
	i18nMessages: Record<string, string> | null
	/**
	 * Per declared key, the arguments its source pattern takes (LT-250,
	 * ADR 0030 s4): `[]` for an argument-less message — `t.<key>` is a
	 * string — else each argument's name and kind (`plural`/`selectordinal`/
	 * `number` → number, `date`/`time` → date, `select` → string, a plain
	 * `{x}` → string or number — LT-344), which is
	 * what LT-308 types `t.<key>({ … })` from. A key whose source pattern
	 * failed to parse (LTC055) is absent. Null exactly when `i18nMessages`
	 * is. Optional because it is contract IR (a new field is additive only
	 * when optional).
	 */
	i18nArgs?: Record<string, readonly MessageArg[]> | null
	/**
	 * Whether the parameter pattern declares the reserved `i18n` parameter
	 * (ADR 0030 sub-design 2). The compiler — never a caller — supplies the
	 * record at every render call boundary; see `emit-server.ts`'s compose
	 * emission and the registry flag the fixtures read.
	 */
	declaresI18n: boolean
	/**
	 * The parameter-bound identifier for the component's locale (`lang`, or
	 * the nested `i18n: { lang }` spelling), or null. The emitter uses it
	 * for the root `lang` attribute; null means the component binds no
	 * locale it could render.
	 */
	langBinding: string | null
	/**
	 * The authored `lang` default (`lang = 'en'`), or null — ADR 0030
	 * sub-design 3's precedence anchor for the record compose sites build.
	 */
	langArgDefault: string | null
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
	/**
	 * Every reactive-list item's setup statements (ADR 0046 s5), flattened
	 * across loops — the usage walks that place imports and pick the
	 * client-needed setup consts read them; each loop's own list
	 * (`ReconcileForIR.setup`) is what the emitters write.
	 */
	itemSetup: ItemSetupStmt[]
	signals: SignalIR[]
	/** The `expose({...})` call, or null when the component declares none. */
	expose: ExposeStmt | null
	/**
	 * Every prop `expose()` declares, whatever its initializer shape, in
	 * source order (LT-288, ADR 0040 s4). `RegistryEntry.exposedProps` is
	 * the `kind` projection of this map.
	 */
	exposeProps: ReadonlyMap<string, ExposePropDecl>
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
	/**
	 * Every well-formed `first()` declaration, by bound name, in source
	 * order (LT-288, ADR 0040 s4) — how each resolved against the template
	 * is `stage`, not a different collection.
	 */
	firstRefs: ReadonlyMap<string, FirstRefDecl>
	/**
	 * The declared contract of the component's `children` arg (ADR 0048 s2,
	 * LT-474), read from its `Children<Roles, Model>` annotation: the roles
	 * the child may address the passed content through (role class →
	 * expected tag) and the declared content model. Present exactly when the
	 * annotation reads; the reach-in check (LTC083) runs with no declared
	 * roles otherwise. Optional: contract IR; a front end that omits it only
	 * loses that one check.
	 */
	childrenContract?: ChildrenContractIR
	/** `@for` loops, keyed by their template node. */
	fors: Map<AstNode, ForIR>
	/** Dedented verbatim CSS ("" when no style block). */
	css: string
	/**
	 * The stylesheet's raw (undedented) text — the text `sheet`'s locs
	 * resolve against and the slice the scoped emission partitions
	 * (LT-304). Null when there is no parsed sheet.
	 */
	sheetText?: string | null
	/**
	 * The parsed stylesheet (ADR 0033 s9, LT-268): the rules, selectors and
	 * at-rules of the `<style>` block, reachable for the scoped emission
	 * (LT-304) and the checks over the parsed sheet (ADR 0042). Null when
	 * the component has no style block, the block is empty, or the sheet
	 * does not parse (LTC064 reports). READ-ONLY: the lightningcss visitor
	 * collects the parse and returns nothing — returning parsed nodes into
	 * the parser crashes on `var()` inside nested rules at 1.33, which is
	 * why the scoped emission is string-level (`css-scope.ts`).
	 * Optional: contract IR; a front end that omits it only loses the
	 * sheet and its checks.
	 */
	sheet?: ComponentSheet | null
	/** Module-level `type`/`interface` declarations, exported or not, verbatim. */
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
	 * uses it to skip the `expose.argNode` `any`-stub for a name that already
	 * has a real import (LT-019's stub predates plain-import support, when a
	 * custom Parser's factory name could never resolve server-side at all).
	 */
	imports: {
		server: string[]
		client: string[]
		serverLocalNames: ReadonlySet<string>
		/**
		 * Real `@zeix/le-truc` export names an authored import provides to
		 * the CLIENT module (ADR 0024 sub-design 16) — `emit-client.ts`
		 * subtracts these from its synthesized `@zeix/le-truc` import line so
		 * a name is never bound by two import statements in one module.
		 */
		clientLeTrucNames: ReadonlySet<string>
		/**
		 * Every locally-bound name across ALL plain imports, regardless of
		 * placement (LT-091) — `badFreeNames` accepts these in client-thunk
		 * free-name checks because any client-traced node referencing a
		 * plain import makes the placement fixpoint (`computeClientNeededNames`)
		 * pull that import into the client module; whether it is needed
		 * client-side is decided downstream of the analysis that consults
		 * this set, so placement-agnostic membership is the sound check.
		 */
		plainLocalNames: ReadonlySet<string>
	}
	/**
	 * What each composed child can render into this component's DOM, keyed
	 * by compose source and closed over the child's own compose graph
	 * (LT-096). Set by `analyzeClient` in the registry-aware pass; absent in
	 * the discovery pass, where the selector engine keeps its single-template
	 * view. See `RenderedShape`.
	 */
	composedShapes?: ReadonlyMap<string, ComposedMarkup>
}

/** A composed child's DOM tag and every shape its subtree renders (LT-096). */
export type ComposedMarkup = {
	/** Null when the source has no registry entry — unknown markup. */
	tag: string | null
	shapes: readonly RenderedShape[]
	/**
	 * What the child renders inside the composing parent's Children Region
	 * besides the parent's content (ADR 0048 s1), closed over the compose
	 * graph. Null when the parent's content is not addressable there: the
	 * child inserts no `children`, or inserts them where no marker names
	 * the parent.
	 */
	region: readonly RenderedShape[] | null
	/** The composing parent's tag: the owner its regions are marked with. */
	owner: string
}

/**
 * One element a component's template can render, as the selector engine
 * sees it (LT-096) — recorded on the registry entry so a PARENT can prove a
 * synthesized selector cannot match inside this component's markup, which
 * `querySelector` descends into at runtime. `attrs` are the static
 * attributes; `dynamic` names attributes whose value is only known at render
 * time (they may match anything). `compose` stands for a composed child's
 * own shapes, resolved through the registry, with the attributes its
 * compose site adds to the child's host; `any` for markup the template
 * cannot know (a `truc:html` site); `children` for a `{children}` insertion,
 * as unknown as `any` except where the content's owner is known — inside a
 * composing parent's closure, where the content is the parent's own markup
 * (ADR 0048 s1).
 */
export type RenderedShape =
	| {
			kind: 'element'
			tag: string
			attrs: Record<string, string | null>
			dynamic: string[]
	  }
	| {
			kind: 'compose'
			source: string
			/**
			 * The compose site's static attributes and the names of its
			 * dynamic `class`/`id`/`data-*` ones (LT-505): they land on the
			 * composed child's host, so they merge into it there.
			 */
			attrs: Record<string, string>
			dynamic: string[]
	  }
	| { kind: 'any' }
	| { kind: 'children' }
