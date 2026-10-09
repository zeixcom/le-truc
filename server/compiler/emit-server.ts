/**
 * Server-module emitter (ADR 0024 milestone 1, LT-001).
 *
 * Emits one module per component exporting `render<Name>(args): string`.
 * The generated function re-declares the source's `@{ }` setup verbatim —
 * executable because the signal constructors and `expose()` resolve to the
 * server runtime harness (signals are their initial values in a box) — and
 * then builds the HTML string:
 *
 * - `{expr}` over server data → escaped interpolation
 * - reactive children and thunk attributes render their initial value
 *   when the dependency closure is server-known (args, setup names, loop
 *   bindings, hoisted consts); otherwise the attribute is omitted — the
 *   first client binding pass sets it (dependency-provable evaluation,
 *   ADR 0024 sub-design 3)
 * - `on*` event attributes and `ref` are stripped
 * - `@for` over server data renders once per item, hoisted consts included
 */

import {
	type BoundaryArmRoot,
	htmlThunkSignalName,
	isBoundaryArmRoot,
	lazyCatchMessageEl,
} from './analysis/effects'
import type { AstNode } from './ast-node'
import { freeIdentifiers, hostPropOf } from './ast-utils'
import {
	CHILDREN_MARKER,
	type ChildrenInsertions,
	childrenInsertionsOf,
	isChildrenInsertion,
} from './children-region'
import { CodeBuilder, HtmlWriter, jsData, jsString } from './codegen'
import { isVoidElement } from './core'
import {
	foldableHostProps,
	foldableRefGuards,
	foldableRenderScope,
	hostDerivedFold,
	hostSeedExpr,
	initializerHostReads,
	isServerEvaluable,
	spliceHostDerivedFold,
} from './evaluability'
import { declaredRefNames } from './first-refs'
import { i18nAnnotated } from './i18n'
import { carriedKinds, FORMATTING_KINDS, type Message } from './icu/evaluate'
import { clientSourceRecord } from './icu/parse'
import { RUNTIME_HARNESS_EXPORTS } from './imports'
import type {
	ArmTemplate,
	AttributeIR,
	ComponentIR,
	ContextSignalIR,
	ForIR,
	ItemSetupStmt,
	ReconcileForIR,
	SetupStmt,
	TemplateNode,
} from './ir'
import { aliasScopeOf, harvestsPerField, isAliasHarvestable } from './key-alias'
import { NO_DEPS } from './reactivity'
import type { InternalRegistryEntry } from './registry'
import { onServer } from './setup-extraction'
import { reindent, type SourceSpan } from './spans'
import type { EvaluationTier } from './tier'
import { CLIENT_ONLY_PRIMITIVES, CONTEXT_NAMES, JS_GLOBALS } from './vocabulary'
import {
	armSetOf,
	type ConditionalNode,
	childNodes,
	elseOf,
	enclosingLists,
	hasArmSet,
	inNestedScope,
	isIf,
	listIndexOf,
	thenOf,
	walkTemplate,
} from './walk'

/* === Types === */

export type EmittedServerModule = {
	/** Full TypeScript source of the generated module. */
	code: string
	/** Runtime helper names the module imports. */
	runtimeImports: Set<string>
	/**
	 * Generated-file ↔ `.tsrx`-source span table (LT-011) for the verbatim
	 * setup statements re-declared in this module. The server half is not
	 * type-checked by `check:corpus` today (TS diagnostics only arise in code
	 * that lowers into the client module), but the setup statements ARE
	 * verbatim here too, so the table is recorded for parity and future use.
	 */
	spans: SourceSpan[]
}

type ElementNode = Extract<TemplateNode, { kind: 'element' }>
type TryNode = Extract<TemplateNode, { kind: 'try' }>
type ComposeNode = Extract<TemplateNode, { kind: 'compose' }>

/**
 * The harness names the emitter itself writes calls to (LT-302) — as
 * opposed to the authored vocabulary (`createCell`, `expose`, the parsers)
 * that reaches the module inside verbatim setup text. An arg, setup const,
 * loop variable or catch parameter of the same name would shadow the
 * import inside the render function (`for (const item of items(items))`),
 * so a colliding name is imported under a `__` alias instead. The alias
 * applies only on a collision: every other module stays byte-identical.
 */
const EMITTED_HARNESS_NAMES = [
	'attr',
	'clientLocale',
	'clientMessages',
	'cls',
	'composeHostAttrs',
	'entries',
	'esc',
	'i18nRecord',
	'isPending',
	'items',
	'refStub',
	'sanitizeHtml',
	'styleAttr',
	'text',
	'textOf',
	'witnessHarvest',
] as const
type EmittedHarnessName = (typeof EMITTED_HARNESS_NAMES)[number]

/** Every name the render function binds, for the harness-alias check. */
const renderScopeNames = (component: ComponentIR): Set<string> => {
	// Bindings only — not `serverKnown`, which also holds module imports: an
	// authored `isPending` import IS the harness name, not a shadow of it.
	const names = new Set<string>(component.paramNames)
	for (const stmt of component.setup) if (stmt.name) names.add(stmt.name)
	for (const loop of component.fors.values()) {
		names.add(loop.itemName)
		if (loop.kind === 'each') {
			if (loop.indexName) names.add(loop.indexName)
			for (const hoisted of loop.hoisted) names.add(hoisted.name)
		} else {
			if (loop.keyName) names.add(loop.keyName)
			for (const stmt of loop.setup) if (stmt.name) names.add(stmt.name)
		}
	}
	walkTemplate(component.root, node => {
		if (node.kind === 'try' && node.catchParam) names.add(node.catchParam)
	})
	return names
}

/** The import specifier for `name`, aliased when the emitter aliased it. */
const importSpecifier = (name: string, local: string): string =>
	local === name ? name : `${name} as ${local}`

/**
 * The template emitters' shared state (LT-225): what `emit`/`emitElement`/
 * `emitFor`/`emitListFor` used to close over inside `emitServerModule`,
 * threaded explicitly so the emitters can live at module scope. The scalar
 * fields are reassigned in place by the emitters — the save/restore
 * discipline around `buffer` and the unique-buffer
 * counter sequences are unchanged from the closure era (the golden suite
 * is the proof).
 */
type EmitContext = {
	component: ComponentIR
	/**
	 * Composed (PascalCase) elements' targets, keyed by resolved `.tsrx`
	 * source path (ADR 0024 sub-design 10). A compose node whose `source`
	 * is missing here was already diagnosed as an error upstream
	 * (`index.ts`), so `emitCompose` never needs to handle a missing entry.
	 */
	composeRegistry: ReadonlyMap<string, InternalRegistryEntry> | undefined
	/** The render function's markup statements, in emission order. */
	out: CodeBuilder
	/** Runtime harness names referenced by the emitted code → import line. */
	used: Set<string>
	/** Composed component name → generated server module specifier. */
	composeImports: Map<string, string>
	/**
	 * The current push target: `__html` normally; @try arms render into an
	 * isolated `__arm` buffer so a mid-arm throw cannot leak partial markup
	 * into the output (the catch arm renders its own fresh buffer), and
	 * composed elements' children (LT-018) render into their own uniquely
	 * named buffers — a nested arm must never shadow its enclosing one.
	 */
	buffer: string
	/** Unique suffix counters for @try arm / composed-children buffers. */
	armCounter: number
	childrenCounter: number
	/**
	 * The Children Region (ADR 0048 s1): the render function's owner
	 * parameter — the tag of the compiled component whose content fills this
	 * one's `{children}`, absent for a page-rendered instance — and the
	 * elements that carry it as the region marker. Null when the template
	 * forwards or marks no insertion.
	 */
	childrenOwner: string | null
	childrenInsertions: ChildrenInsertions
	/**
	 * Set when a compose site supplies a child's reserved `i18n` record
	 * (ADR 0030 sub-design 2): pulls the `i18nRecord` import into the module.
	 */
	usedI18nRecord: boolean
	/**
	 * LT-173 step 6: the render-scope names a host-derived fold may leave in
	 * a spliced thunk — computed once per module, the same set the analyzer's
	 * LTC034 check passes to `hostDerivedFold` (the two must agree).
	 */
	foldScope: ReadonlySet<string>
	/**
	 * LT-385c: set while an arm `<template>` renders (ADR 0037). A
	 * client-written site inside it — a lazy text child, a reactive
	 * attribute, a class/style map — has no initial value: the condition
	 * picked another arm, so evaluating the site would read the world under
	 * the wrong condition (the null-guard idiom throws on a Folded
	 * component). Such a site bakes EMPTY (text dropped, attribute omitted);
	 * server-known content (args, `t.`, static markup) still bakes, and the
	 * arm's mount writes the rest on enter. The live winner renders outside
	 * this flag and keeps its values.
	 */
	inArmTemplate: boolean
	/**
	 * LT-424: the item and key names of the enclosing reactive lists whose
	 * extracted `<template>` is rendering — bound in no template render,
	 * because the template renders once, outside the loop. A `server`
	 * attribute reading one (a key-derived attribute inside a nested arm or
	 * list) bakes empty there; the owning scope's mount sets it.
	 */
	templateUnbound: ReadonlySet<string>
	/**
	 * The item names of the reactive lists whose server loop is open (ADR
	 * 0046 s3): the loop binds each to the item CELL the list hands out, so
	 * the bare `{item}` fill reads it with `.get()` — and so does a bare
	 * read of a signal the item's setup declares (ADR 0046 s5).
	 */
	listItems: Set<string>
	/**
	 * The render-time flag of each reactive list below a server-known
	 * branch (LT-454): set wherever the list renders — a live item, an arm
	 * or an enclosing list's template, each folding the same branch — so its
	 * hoisted template ships only when its container can exist.
	 */
	listFlags: Map<ReconcileForIR, string>
	/**
	 * The key-alias witnesses (ADR 0047 s2, LT-453): per alias scope, the
	 * harvested list and the `__witnessN` array its live items push their
	 * keys to, in render order.
	 */
	witnesses: Map<ReconcileForIR, { list: string; keys: string }>
	/**
	 * Every loop's `emptyArm` roots (LT-212). They sit in the template tree
	 * as the loop output's following siblings, so selector resolution and
	 * the id/prose checks see them, but they render from inside the loop
	 * emission: the plain child walk skips them.
	 */
	emptyArmNodes: ReadonlySet<TemplateNode>
	/** Unique suffix counter for the loops' `__emptyN` flags. */
	emptyCounter: number
	/**
	 * The local name of a harness import the emitter synthesizes a call to
	 * (LT-302): the bare name, or `__<name>` when a render-scope name
	 * shadows it. See {@link EMITTED_HARNESS_NAMES}.
	 */
	h: (name: EmittedHarnessName) => string
	/**
	 * A name the emitter mints for its own locals (`__html`, `__arm1`,
	 * `__async1`, `__children1`, `__key`, `__empty0`), renamed with a
	 * leading `_` while a render-scope name already binds it (LT-234: the
	 * client's reserved-name policy). Renames, never errors.
	 */
	mint: (name: string) => string
}

/* === Internal Functions === */

/** One `<buffer>.push(<expr>)` statement into the current buffer. */
const push = (ctx: EmitContext, expr: string): void => {
	ctx.out.line(`${ctx.buffer}.push(${expr})`)
}

/**
 * One text position into `out`'s buffer, through a typed text sink (ADR 0046
 * s6, LT-428): `text(value)`, or `textOf(thunk)` for an authored arrow. An
 * object or a boolean reaching it is a tsc error, so when `value` is spelled
 * from the authored child's own text (`item`, `data.get()`, `e.message`) the
 * statement carries spans that let `check:corpus` report it at the authored
 * line. The sink call itself maps there too: it anchors the search, so a
 * one-letter child (`{e}`) is not found inside `push`.
 */
const pushText = (
	ctx: EmitContext,
	out: CodeBuilder,
	sink: 'text' | 'textOf',
	value: string,
	child: { expr: AstNode; exprText: string } | null,
): void => {
	ctx.used.add(sink)
	const call = `${ctx.h(sink)}(`
	const start = child?.expr.start
	const slices =
		child && typeof start === 'number' && value.startsWith(child.exprText)
			? [
					{ text: call, start },
					{ text: child.exprText, start },
				]
			: []
	out.line(`${ctx.buffer}.push(${call}${value}))`, slices)
}

/** Push a closing tag, unless the element is void. */
const pushClose = (ctx: EmitContext, tag: string): void => {
	if (!isVoidElement(tag)) push(ctx, jsString(`</${tag}>`))
}

/**
 * LT-182: the setup statements a suppressed-harness module still has to
 * declare — those whose declared name the emitted code references,
 * transitively.
 *
 * Seeded from the generated markup, then closed over the retained statements'
 * OWN texts to a fixpoint, because a retained statement may reference a name
 * the markup never mentions. `form-textbox` is the corpus's one live case:
 * the markup reads `remainingCount`, whose thunk reads `descriptionCell`,
 * which appears nowhere in the markup — a one-step seed would drop it.
 *
 * The reference test is identifier-boundary tokenisation of the generated
 * text — deliberately a text match, not a scope analysis: the generated text
 * is exactly what must resolve. It can over-retain (a name that also appears
 * inside a static string literal survives as a dead const, which is the
 * Folded behaviour anyway); it cannot under-retain, because a genuine
 * reference appears verbatim.
 *
 * A statement with no declared name (`expose()`) can never be referenced and
 * is therefore always dropped. A `requestContext` statement is emitted as
 * `createCell(fallback)` rather than verbatim, but its fallback text is a
 * substring of `stmt.text`, so seeding from the verbatim text can only
 * over-retain here too.
 */
const retainReferenced = (
	setup: readonly SetupStmt[],
	markup: readonly string[],
): SetupStmt[] => {
	const identifiersIn = (text: string): string[] =>
		text.match(/[A-Za-z_$][\w$]*/g) ?? []
	const referenced = new Set(markup.flatMap(identifiersIn))
	const retained = new Set<SetupStmt>()
	for (let changed = true; changed; ) {
		changed = false
		for (const stmt of setup) {
			if (retained.has(stmt) || stmt.name === null) continue
			if (!referenced.has(stmt.name)) continue
			retained.add(stmt)
			for (const name of identifiersIn(stmt.text)) referenced.add(name)
			changed = true
		}
	}
	return setup.filter(stmt => retained.has(stmt))
}

/**
 * The Folded tier's setup: every statement verbatim, except a
 * server-unevaluable one (it reads a client-only primitive or ref) that
 * neither the markup nor another kept statement references (LT-323). Such a
 * statement feeds only client-only positions — module-catalog's
 * `total = createMemo(() => all(…)…)`, read by a `truc:pass` thunk alone —
 * so the harness has nothing to evaluate it for, and declaring it would
 * reference a name the render function does not have. A referenced one is
 * kept: that shape is unsound and surfaces as a tsc failure, as before.
 */
const dropUnreferencedUnevaluable = (
	setup: readonly SetupStmt[],
	unevaluable: (stmt: SetupStmt) => boolean,
	markup: readonly string[],
): SetupStmt[] => {
	const identifiersIn = (text: string): string[] =>
		text.match(/[A-Za-z_$][\w$]*/g) ?? []
	let kept = [...setup]
	for (let changed = true; changed; ) {
		changed = false
		const referenced = new Set([
			...markup.flatMap(identifiersIn),
			...kept.flatMap(stmt =>
				identifiersIn(stmt.text).filter(name => name !== stmt.name),
			),
		])
		const next = kept.filter(
			stmt =>
				!unevaluable(stmt) || stmt.name === null || referenced.has(stmt.name),
		)
		if (next.length !== kept.length) {
			kept = next
			changed = true
		}
	}
	return kept
}

/**
 * A lazy child's initial server value: a signal identifier reads `.get()`,
 * a thunk is returned as such (`thunk: true`, rendered through `textOf`,
 * which invokes it), an exposed-prop string key resolves through
 * `expose()`'s prop→signal map, anything else is the expression itself.
 * A managed form prop (`validationMessage`) renders empty — the library
 * owns its value, and empty is its connect-time state.
 */
const lazyValueExpression = (
	component: ComponentIR,
	exprText: string,
	expr: AstNode,
	scope: ReadonlySet<string>,
	foldScope: ReadonlySet<string>,
	onSeed?: (seed: string) => void,
): { expr: string; thunk: boolean } => {
	const value = (text: string) => ({ expr: text, thunk: false })
	if (expr.type === 'Identifier') {
		const name = String(expr.name)
		if (component.signals.some(s => s.name === name))
			// An unresolvable signal (an unseeded sensor) is not in scope.
			return value(scope.has(name) ? `${name}.get()` : "''")
		return value(exprText)
	}
	// Anything else (a call expression, an arrow thunk, a bare non-signal
	// identifier, …) is only safe to render verbatim if its dependency
	// closure is server-known — the same rule attribute thunks already
	// follow (`isServerEvaluable(thunk, scope)`, the single gate in
	// evaluability.ts). A lazy
	// child referencing `host` (a client-only ambient, e.g. `formatHex(host
	// .value)`) has no server value at all: render nothing initially, the
	// client's `watch()` for this reactive child corrects it on connect (DOM-is-
	// truth, ADR 0003) — same posture as an omitted non-server-known thunk
	// attribute. Found and fixed alongside LT-034 (`card-colorscale.tsrx`'s
	// hex-value lazy child called `formatHex(host.value)`, which used to
	// render verbatim server-side where `host` doesn't exist).
	// LT-317: a `host.<prop>` thunk folds through the same two routes the
	// `reactive` attribute case takes (the bare mirror, then the
	// host-derived splice) before falling back to empty — so a
	// Parser-exposed prop's text site ships its value before JS, exactly
	// like its attribute sites.
	if (expr.type === 'ArrowFunctionExpression') {
		const mirror = hostPropMirrorExpr(component, expr)
		if (mirror !== null) return value(mirror)
		const derived = hostDerivedExpr(
			component,
			expr,
			exprText,
			foldScope,
			onSeed,
		)
		if (derived !== null) return value(derived)
	}
	if (!isServerEvaluable(expr, scope)) return value("''")
	if (expr.type === 'ArrowFunctionExpression')
		return { expr: exprText, thunk: true }
	return value(exprText)
}

/**
 * The server expression for a `() => host.<prop>` mirror: the parser-exposed
 * prop's value at render time IS the root attribute's server expression
 * (DOM-is-truth — the host attribute is the prop's seed, ADR 0003). Null when
 * the prop is not Parser-exposed or the root does not render its attribute.
 * The `() => host.<prop>` pattern match is `hostPropOf` (ast-utils), shared
 * with the analyzer's dispatch decision.
 */
const hostPropMirrorExpr = (
	component: ComponentIR,
	thunk: AstNode,
): string | null => {
	const propName = hostPropOf(thunk)
	if (propName === null || !component.exposeProps.get(propName)?.parser)
		return null
	const rootAttr = component.root.attrs.find(
		(a): a is Extract<AttributeIR, { kind: 'server' }> =>
			a.kind === 'server' && a.name === propName,
	)
	return rootAttr ? rootAttr.exprText : null
}

/**
 * Register every runtime-harness name a spliced seed names (LT-386): a
 * Parser-backed seed calls its factory (`asInteger()(attrValue(count))`),
 * and the module's import line must provide both it and `attrValue` — in
 * the Folded tier the verbatim setup already provides the factory, in the
 * suppressed tiers only this registration does.
 * Plain-import and setup-const names need nothing here: their placement
 * counts the `expose()` statement's free names and the emitted markup's
 * references respectively, in every tier.
 */
const useSeedNames = (ctx: EmitContext, seed: string): void => {
	for (const id of seed.match(/[A-Za-z_$][\w$]*/g) ?? [])
		if (RUNTIME_HARNESS_EXPORTS.has(id)) ctx.used.add(id)
}

/**
 * The server expression for a thunk that reads ONLY `host.<prop>` members
 * (LT-085, CHECKLIST §5 widening of the fold rule beyond the bare mirror
 * above): each `host.<prop>` range is spliced for that prop's server seed
 * (`hostSeedExpr`, evaluability.ts — the parser applied to the root
 * attribute, a plain-value initializer, the attribute expression, or the
 * harvesting arg), then the whole rewritten thunk is IIFE-invoked, same
 * posture as the plain-`isServerEvaluable` case below. Null when the thunk
 * reads anything other than foldable `host.<prop>` members (a signal, a
 * bare `host` escape, an unexposed prop). `onSeed` receives every spliced
 * seed so the caller can import the harness names one names (a Parser
 * factory).
 */
const hostDerivedExpr = (
	component: ComponentIR,
	thunk: AstNode,
	thunkText: string,
	allow: ReadonlySet<string>,
	onSeed?: (seed: string) => void,
): string | null => {
	const reads = hostDerivedFold(
		thunk,
		foldableHostProps(component),
		foldableRefGuards(component),
		allow,
	)
	if (reads === null || reads.length === 0) return null
	const spliced = spliceHostDerivedFold(
		thunkText,
		typeof thunk.start === 'number' ? thunk.start : 0,
		reads,
		(prop, kind) => {
			// A ref read folds to whatever decides its presence in the
			// server's OWN output (LT-118) — `refBranchGuard`'s condition.
			if (kind === 'ref') return foldableRefGuards(component).get(prop) ?? ''
			// Membership in foldableHostProps and the seed are one account
			// (evaluability.ts, LT-386): the parser applied to the root
			// attribute, the plain-value initializer, the attribute
			// expression, or the harvesting arg — never a guess.
			const seed = hostSeedExpr(component, prop)
			if (seed !== null) onSeed?.(seed)
			return seed ?? ''
		},
	)
	return `(${spliced})()`
}

/**
 * The extracted `<template>` (ADR 0046 s2): stamped `data-list="N"` — the
 * list's compile-time document-order index, which the client's `reconcile`
 * call queries from the host — statics render, and
 * server-known content folds in at render time as today. Item-dependent
 * sites bake EMPTY (ADR 0037 s1's losing-arm rule): a lazy child (the bare
 * `{item}` shorthand and its arrow spelling alike — the item mount writes
 * either on enter, so the two surfaces bake the same bytes; LT-425 retired
 * the slot-fill `<slot>` marker), a reactive or map attribute, and a
 * key-derived attribute (a `server` attribute over the key binding alone — the mount sets it against the clone's key parameter;
 * the live items render the same value from the loop's own key binding) all
 * push nothing. A server-known conditional inside the item renders its
 * winner — the winner is fixed per render call, so every clone carries the
 * same arm — and a composed child renders its child call into the template.
 * Written into a fork of the markup builder: the caller appends it at the
 * host's end (`emitListTemplates`), outside every container.
 */
const listTemplate = (
	ctx: EmitContext,
	loop: ReconcileForIR,
	listIndex: number,
	scope: ReadonlySet<string>,
): CodeBuilder => {
	const out = ctx.out.fork()
	const pushTo = (expr: string): void => {
		out.line(`${ctx.buffer}.push(${expr})`)
	}
	pushTo(`'<template data-list="${listIndex}">'`)
	// The item's own names are unbound in the template render, which runs
	// once, outside the loop (ADR 0046 s5).
	const unbound = [
		loop.itemName,
		...(loop.keyName === null ? [] : [loop.keyName]),
		...loop.setup.flatMap(stmt => (stmt.name === null ? [] : [stmt.name])),
	]
	const cloneTime = new Set(
		loop.setup.flatMap(stmt => (stmt.kind === 'const' ? [stmt.name] : [])),
	)
	if (loop.keyName !== null) cloneTime.add(loop.keyName)
	// A nested arm set or loop (LT-424) renders through the main emitter in
	// template mode — no live arm, no items, the enclosing items' bindings
	// unbound — into this template. A nested list's own template is not
	// copied in: it renders once, at the host's end (ADR 0046 s2).
	const nested = (node: TemplateNode): void => {
		const saved = {
			out: ctx.out,
			inArmTemplate: ctx.inArmTemplate,
			templateUnbound: ctx.templateUnbound,
		}
		ctx.out = out
		ctx.inArmTemplate = true
		ctx.templateUnbound = new Set([...saved.templateUnbound, ...unbound])
		try {
			emit(ctx, node, scope)
		} finally {
			ctx.out = saved.out
			ctx.inArmTemplate = saved.inArmTemplate
			ctx.templateUnbound = saved.templateUnbound
		}
	}
	const shape = (node: TemplateNode): void => {
		// A nested list's `@empty` roots render from its own emission.
		if (ctx.emptyArmNodes.has(node)) return
		if (
			hasArmSet(node) ||
			(node.kind === 'element' &&
				node !== loop.output &&
				[...ctx.component.fors.values()].some(f => f.output === node))
		) {
			nested(node)
			return
		}
		if (node.kind === 'text') {
			pushTo(jsString(node.value, 'double'))
			return
		}
		if (node.kind === 'expr') {
			if (node.reactivity === 'server')
				pushText(ctx, out, 'text', node.exprText, node)
			// A lazy child is item-dependent: baked empty, the item mount
			// writes it on enter.
			return
		}
		if (node.kind === 'conditional' && node.mode === 'server') {
			// Server-known control flow folds to its winner, evaluated per
			// render call; the template carries that arm for every clone.
			if (isIf(node)) {
				const win = node.arms[0]
				const lose = node.arms[1]
				out.open(`if (${node.testText}) {`)
				if (win) for (const child of win.children) shape(child)
				if (lose && lose.children.length > 0) {
					out.between('} else {')
					for (const child of lose.children) shape(child)
				}
				out.close()
				return
			}
			out.open(`switch (${node.testText}) {`)
			for (const arm of node.arms) {
				out.open(
					`${arm.testText === null ? 'default' : `case ${arm.testText}`}: {`,
				)
				for (const child of arm.children) shape(child)
				out.line('break').close()
			}
			out.close()
			return
		}
		if (node.kind === 'compose') {
			// A composed child renders its child call into the template: the
			// server splices the same markup into every clone (its args are
			// server-known — `validateListBody` refuses item reads).
			const saved = ctx.out
			ctx.out = out
			try {
				emit(ctx, node, scope)
			} finally {
				ctx.out = saved
			}
			return
		}
		// Statics, server-known expressions, and the winner of a server
		// conditional — item-dependent content was refused or bakes empty,
		// and events/refs never render server-side.
		if (node.kind !== 'element') return
		const html = new HtmlWriter().static(`<${node.tag}`)
		for (const attr of node.attrs) {
			if (attr.kind === 'static') html.attr(attr.name, attr.value)
			else if (attr.kind === 'server') {
				// A key-derived attribute (ADR 0046 s1) bakes empty — the
				// mount sets it once at clone; `validateListBody` proved the
				// expression reads the key binding alone.
				const reads = [...freeIdentifiers(attr.node)]
				if (reads.length > 0 && reads.every(n => cloneTime.has(n))) continue
				// An enclosing list's key, while that list's own template renders
				// (LT-424): unbound here, set by the owning mount.
				if (reads.some(n => ctx.templateUnbound.has(n))) continue
				// esc() escapes quotes too, so the value is safe inside the
				// double-quoted attribute the static parts open and close.
				ctx.used.add('esc')
				html
					.static(` ${attr.name}="`)
					.expr(`${ctx.h('esc')}(String(${attr.exprText}))`)
					.static('"')
			}
		}
		pushTo(`${html.static('>')}`)
		for (const child of node.children) shape(child)
		if (!isVoidElement(node.tag)) pushTo(jsString(`</${node.tag}>`))
	}
	out.depth++
	shape(loop.output)
	out.depth--
	pushTo("'</template>'")
	return out
}

/**
 * A `let __listN = false` flag, at the render function's top level, for
 * every reactive list below a server-known branch — a server-mode
 * conditional or a synchronous `@try` (LT-454). A list outside any such
 * branch always renders, so it needs none, and its template ships
 * unconditionally.
 */
const declareListFlags = (ctx: EmitContext): void => {
	const { component } = ctx
	const visit = (node: TemplateNode, guarded: boolean): void => {
		const loop = [...component.fors.values()].find(
			(f): f is ReconcileForIR => f.kind === 'reconcile' && f.output === node,
		)
		if (loop && guarded) {
			const flag = ctx.mint(
				`__list${listIndexOf(component.root, component.fors, loop)}`,
			)
			ctx.listFlags.set(loop, flag)
			ctx.out.line(`let ${flag} = false`)
		}
		const inner =
			guarded ||
			(node.kind === 'conditional' && node.mode === 'server') ||
			(node.kind === 'try' && node.pendingChildren === null)
		for (const child of childNodes(node)) visit(child, inner)
	}
	visit(component.root, false)
}

/**
 * A `const __witnessN: string[] = []` per list harvested through a key
 * alias (ADR 0047 s2): the alias scope's live items push their keys to it,
 * in render order. The harvest pass has refused every other alias shape,
 * so the first alias names the scope.
 */
const declareWitnesses = (ctx: EmitContext): void => {
	const { component } = ctx
	for (const signal of component.signals) {
		if (
			signal.family !== 'declared' ||
			!isAliasHarvestable(component, signal) ||
			!harvestsPerField(signal)
		)
			continue
		const scope = aliasScopeOf(component, signal.name)
		if (!scope) continue
		const keys = ctx.mint(`__witness${ctx.witnesses.size}`)
		ctx.witnesses.set(scope, { list: signal.name, keys })
		ctx.out.line(`const ${keys}: string[] = []`)
	}
}

/**
 * The render witness (ADR 0047 s2): once the render has run, the keys the
 * alias scope rendered must reach every key of the harvested list, first
 * occurrences in list order — else `witnessHarvest` throws, and the build
 * fails before a page ships a list the client would rebuild incomplete.
 */
const checkWitnesses = (ctx: EmitContext): void => {
	for (const { list, keys } of ctx.witnesses.values()) {
		ctx.used.add('witnessHarvest')
		ctx.out.line(
			`${ctx.h('witnessHarvest')}(${jsString(ctx.component.tag)}, ${jsString(list)}, ${list}.keys(), ${keys})`,
		)
	}
}

/**
 * Every reactive list's extracted template, as the host's last children, in
 * document order of N (ADR 0046 s2): one copy per instance, whatever the
 * nesting depth, so a list container may be any element — a Mount Scope
 * root included — and the client queries it from the host. A nested list's
 * template renders with every enclosing scope unbound: its enclosing items'
 * names bake empty (the inner mount writes them on adopt and clone), and
 * client-written sites bake empty as in an arm template (LT-385c). A list
 * below a server-known branch ships its template only when that branch
 * rendered it (`listFlags`); the client queries no template for a container
 * the render left out.
 */
const emitListTemplates = (ctx: EmitContext): void => {
	const { component } = ctx
	const loops = [...component.fors.values()]
		.filter((loop): loop is ReconcileForIR => loop.kind === 'reconcile')
		.map(loop => ({
			loop,
			index: listIndexOf(component.root, component.fors, loop),
		}))
		.sort((a, b) => a.index - b.index)
	for (const { loop, index } of loops) {
		const unbound = enclosingLists(
			component.root,
			component.fors,
			loop.output,
		).flatMap(outer => [
			outer.itemName,
			...(outer.keyName === null ? [] : [outer.keyName]),
			...outer.setup.flatMap(stmt => (stmt.name === null ? [] : [stmt.name])),
		])
		const saved = {
			inArmTemplate: ctx.inArmTemplate,
			templateUnbound: ctx.templateUnbound,
		}
		ctx.inArmTemplate = inNestedScope(
			component.root,
			component.fors,
			loop.output,
		)
		ctx.templateUnbound = new Set(unbound)
		const flag = ctx.listFlags.get(loop)
		try {
			if (flag) ctx.out.open(`if (${flag}) {`)
			ctx.out.append(listTemplate(ctx, loop, index, component.serverKnown))
			if (flag) ctx.out.close()
		} finally {
			ctx.inArmTemplate = saved.inArmTemplate
			ctx.templateUnbound = saved.templateUnbound
		}
	}
}

/**
 * An item's setup in the server's loop (ADR 0046 s5): its plain consts and
 * signal declarations, verbatim, once per initial item — the value harness
 * evaluates each signal once. A `createSensor` start callback or a function
 * const's body may name what only the client binds (`host`, a ref, `on`):
 * defined, never called, here, so those names are declared as `any` stubs
 * for the module to type-check, exactly like `expose()`'s.
 */
const emitItemSetup = (
	ctx: EmitContext,
	loop: ReconcileForIR,
	setup: readonly ItemSetupStmt[],
): void => {
	if (setup.length === 0) return
	const refs = declaredRefNames(ctx.component.firstRefs)
	for (const stmt of loop.setup) if (stmt.kind === 'ref') refs.add(stmt.name)
	const stubs = new Set<string>()
	for (const stmt of setup)
		for (const name of freeIdentifiers(stmt.node))
			if (
				refs.has(name) ||
				CONTEXT_NAMES.has(name) ||
				CLIENT_ONLY_PRIMITIVES.has(name)
			)
				stubs.add(name)
	if (stubs.size > 0) ctx.used.add('refStub')
	for (const name of [...stubs].sort())
		ctx.out.line(`const ${name}: any = ${ctx.h('refStub')}`)
	for (const stmt of setup) {
		if (stmt.kind === 'signal') {
			ctx.used.add(stmt.constructor)
			for (const id of stmt.text.match(/[A-Za-z_$][\w$]*/g) ?? [])
				if (RUNTIME_HARNESS_EXPORTS.has(id)) ctx.used.add(id)
		}
		ctx.out.line(stmt.text, [{ text: stmt.text, start: stmt.range.start }])
	}
}

/**
 * Reactive `@for` over a declared List (ADR 0024 sub-design 5): initial
 * keyed items render in place (adopted children are complete) with
 * `data-key` from the shim's cause-effect-parity key generation. The item
 * shape is extracted as a `<template>` at the host's end
 * (`emitListTemplates`), whose item-dependent sites bake empty.
 */
const emitListFor = (
	ctx: EmitContext,
	loop: ReconcileForIR,
	scope: ReadonlySet<string>,
): void => {
	const keyVar = loop.keyName ?? ctx.mint('__key')
	const loopScope = new Set(scope)
	loopScope.add(loop.itemName)
	if (loop.keyName) loopScope.add(keyVar)
	const setup = loop.setup.filter(onServer)
	for (const stmt of setup) loopScope.add(stmt.name as string)
	const emptyFlag = openEmptyFlag(ctx, loop)
	// Inside a template (an arm's, an enclosing list's; LT-424) the list
	// renders no items: the clone's mount reconciles them from the List.
	if (!ctx.inArmTemplate) {
		ctx.out.open(
			`for (const [${keyVar}, ${loop.itemName}] of ${loop.listSignal}.entries()) {`,
		)
		if (emptyFlag) ctx.out.line(`${emptyFlag} = false`)
		emitItemSetup(ctx, loop, setup)
		const witness = ctx.witnesses.get(loop)
		if (witness) ctx.out.line(`${witness.keys}.push(${keyVar})`)
		// The item and its setup's signals are cells — a bare `{name}` reads
		// `.get()` — and its consts are values that shadow an enclosing one.
		const cells = [
			loop.itemName,
			...setup.flatMap(stmt => (stmt.kind === 'signal' ? [stmt.name] : [])),
		]
		const added = cells.filter(name => !ctx.listItems.has(name))
		for (const name of added) ctx.listItems.add(name)
		const shadowed = setup
			.flatMap(stmt => (stmt.kind === 'const' ? [stmt.name] : []))
			.filter(name => ctx.listItems.delete(name))
		const dataKey: AttributeIR = {
			kind: 'server',
			name: 'data-key',
			exprText: keyVar,
			node: loop.node,
			// Compiler-minted locals: no authored dependency.
			deps: NO_DEPS,
		}
		emitElement(ctx, loop.output, loopScope, [dataKey])
		for (const child of loop.output.children) emit(ctx, child, loopScope)
		for (const name of added) ctx.listItems.delete(name)
		for (const name of shadowed) ctx.listItems.add(name)
		pushClose(ctx, loop.output.tag)
		ctx.out.close()
	}

	// The empty arm stays in the container on the toggle path (ADR 0037
	// s5): always rendered, exempt from reconciliation, hidden while the
	// list has items. The client toggles `hidden` from the list's length.
	if (emptyFlag && loop.emptyArm) {
		ctx.used.add('attr')
		for (const root of loop.emptyArm) {
			if (root.kind !== 'element') continue
			emitElement(ctx, root, scope, [
				{ kind: 'static', name: 'data-unreconciled', value: null },
				{
					kind: 'server',
					name: 'hidden',
					exprText: `!${emptyFlag}`,
					node: loop.node,
					deps: NO_DEPS,
				},
			])
			for (const child of root.children) emit(ctx, child, scope)
			pushClose(ctx, root.tag)
		}
	}
	// The extracted template renders once, at the host's end
	// (`emitListTemplates`, ADR 0046 s2) — below a server-known branch, only
	// once the list rendered somewhere.
	const listFlag = ctx.listFlags.get(loop)
	if (listFlag) ctx.out.line(`${listFlag} = true`)
}

/**
 * A loop with an empty arm (LT-212) tracks whether it rendered any item in
 * a `let __emptyN = true` flag, so the arm works over any iterable, not
 * only over values with a `length`. Returns the flag name, or null (and
 * emits nothing) for a loop without an arm.
 */
const openEmptyFlag = (ctx: EmitContext, loop: ForIR): string | null => {
	if (!loop.emptyArm) return null
	const flag = ctx.mint(`__empty${ctx.emptyCounter++}`)
	ctx.out.line(`let ${flag} = true`)
	return flag
}

const emitFor = (
	ctx: EmitContext,
	loop: ForIR,
	scope: ReadonlySet<string>,
): void => {
	if (loop.kind === 'reconcile') {
		emitListFor(ctx, loop, scope)
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
	ctx.used.add(usesIndex ? 'entries' : 'items')
	const loopScope = new Set(scope)
	loopScope.add(loop.itemName)
	if (loop.indexName) loopScope.add(loop.indexName)
	for (const hoisted of loop.hoisted) loopScope.add(hoisted.name)
	const binding = usesIndex
		? `const [${loop.indexName}, ${loop.itemName}] of ${ctx.h('entries')}(${loop.iterableText})`
		: `const ${loop.itemName} of ${ctx.h('items')}(${loop.iterableText})`
	const emptyFlag = openEmptyFlag(ctx, loop)
	ctx.out.open(`for (${binding}) {`)
	if (emptyFlag) ctx.out.line(`${emptyFlag} = false`)
	for (const hoisted of loop.hoisted)
		ctx.out.line(`const ${hoisted.name} = ${hoisted.initText}`)
	// A name this loop binds shadows an enclosing list item: a value here.
	const shadowed = [
		loop.itemName,
		loop.indexName,
		...loop.hoisted.map(h => h.name),
	].filter(
		(name): name is string => name !== null && ctx.listItems.delete(name),
	)
	emitElement(ctx, loop.output, loopScope)
	for (const child of loop.output.children) emit(ctx, child, loopScope)
	for (const name of shadowed) ctx.listItems.add(name)
	pushClose(ctx, loop.output.tag)
	ctx.out.close()
	if (emptyFlag && loop.emptyArm) {
		ctx.out.open(`if (${emptyFlag}) {`)
		for (const node of loop.emptyArm) emit(ctx, node, scope, true)
		ctx.out.close()
	}
}

const emitElement = (
	ctx: EmitContext,
	element: ElementNode,
	scope: ReadonlySet<string>,
	extraAttrs: AttributeIR[] = [],
): void => {
	const html = new HtmlWriter().static(`<${element.tag}`)
	const attrCall = (name: string, value: string): string =>
		`${ctx.h('attr')}(${jsString(name)}, ${value})`
	let staticClass: string | null = null
	let classExpr: string | null = null
	for (const attr of [...extraAttrs, ...element.attrs]) {
		switch (attr.kind) {
			case 'static':
				if (attr.name === 'class') staticClass = attr.value ?? ''
				else html.attr(attr.name, attr.value)
				break
			case 'server':
				// LT-424: an authored attribute over an enclosing list's item or
				// key bakes empty in that list's template — the mount sets it.
				// (The emitter's own `extraAttrs` carry placeholder nodes.)
				if (
					ctx.templateUnbound.size > 0 &&
					element.attrs.includes(attr) &&
					[...freeIdentifiers(attr.node)].some(n => ctx.templateUnbound.has(n))
				)
					break
				ctx.used.add('attr')
				html.expr(attrCall(attr.name, attr.exprText))
				break
			case 'reactive': {
				// LT-385c: a reactive attribute bakes nothing inside an arm
				// template — the mount writes it on enter.
				if (ctx.inArmTemplate) break
				const mirror = hostPropMirrorExpr(ctx.component, attr.thunk)
				const derived =
					mirror === null
						? hostDerivedExpr(
								ctx.component,
								attr.thunk,
								attr.thunkText,
								ctx.foldScope,
								seed => useSeedNames(ctx, seed),
							)
						: null
				if (mirror !== null) {
					ctx.used.add('attr')
					html.expr(attrCall(attr.name, mirror))
				} else if (derived !== null) {
					ctx.used.add('attr')
					html.expr(attrCall(attr.name, derived))
				} else if (isServerEvaluable(attr.thunk, scope)) {
					ctx.used.add('attr')
					html.expr(attrCall(attr.name, `(${attr.thunkText})()`))
				}
				break
			}
			case 'class-map':
				// LT-385c: map entries bake nothing inside an arm template.
				if (!ctx.inArmTemplate && isServerEvaluable(attr.object, scope)) {
					ctx.used.add('cls')
					classExpr = `${ctx.h('cls')}((${attr.thunkText})())`
				}
				break
			case 'style-map':
				// LT-385c: same as class-map.
				if (!ctx.inArmTemplate && isServerEvaluable(attr.object, scope)) {
					ctx.used.add('attr')
					ctx.used.add('styleAttr')
					html.expr(
						attrCall(
							'style',
							`${ctx.h('styleAttr')}((${attr.thunkText})()) || null`,
						),
					)
				}
				break
			case 'event':
			case 'ref':
			// A handler-arg placement renders nothing (LT-461).
			case 'handler-arg':
				break
		}
	}
	if (ctx.childrenOwner && ctx.childrenInsertions.holders.has(element)) {
		ctx.used.add('attr')
		html.expr(attrCall(CHILDREN_MARKER, ctx.childrenOwner))
	}
	if (classExpr || staticClass !== null) {
		html.static(' class="')
		if (staticClass) html.text(staticClass)
		if (classExpr) {
			if (staticClass) html.static(' ')
			html.expr(classExpr)
		}
		html.static('"')
	}
	push(ctx, `${html.static('>')}`)
}

/** Compose-site attributes that land on the child's root, not in its args. */
const isComposeHostAttr = (name: string): boolean =>
	name === 'class' || name === 'id' || name.startsWith('data-')

/**
 * A composed element (ADR 0024 sub-design 10): splice the child's
 * generated `render<Name>()` call inline. Composed elements never had
 * their diagnostics escalate to an error (index.ts validates every
 * `node.source` against composeRegistry before emitServerModule runs at
 * all), so a missing entry is unreachable here.
 *
 * The option carrier (LT-460) serves the arm-root form: `extraHostAttrs`
 * splices the arm's `data-key` onto the child's rendered root through the
 * same `composeHostAttrs` path as authored `class`/`id`/`data-*`. The
 * composed content emits through the generic paths — the catch parameter's
 * reads inside a message element are ordinary reactive text sites (live
 * arm: in scope; inert template: baked empty, LT-385c), and a reactive
 * expression directly inside composed content is refused upstream.
 */
const emitCompose = (
	ctx: EmitContext,
	node: ComposeNode,
	scope: ReadonlySet<string>,
	opts: {
		extraHostAttrs?: Array<AttributeIR & { kind: 'static' }>
	} = {},
): void => {
	const entry = ctx.composeRegistry?.get(node.source)
	if (!entry) return
	ctx.composeImports.set(entry.name, `./${entry.tag}.server`)
	const args = node.attrs
		.filter(
			(a): a is Extract<typeof a, { kind: 'arg' }> =>
				a.kind === 'arg' &&
				// `class`/`id`/`data-*` on a composed element address the
				// COMPOSE SITE (the child's host element), not typed props —
				// filtered out of the forwarded args and spliced onto
				// the child's rendered root via `composeHostAttrs` below
				// (LT-089's discriminator vocabulary, materialized by
				// LT-090; `data-*` since LT-320, when a per-item
				// `data-product={product.id}` was forwarded as an unknown
				// arg and dropped).
				!isComposeHostAttr(a.name),
		)
		.map(a => `${jsString(a.name, 'double')}: ${a.exprText}`)
	// A composed element's children (LT-018) render into their own
	// buffer, once, server-side — the joined string is forwarded as
	// the child's `children` server arg (self-closing tags pass none,
	// matching "no children supplied" at the type level).
	if (node.children.length > 0) {
		const childrenVar = ctx.mint(`__children${++ctx.childrenCounter}`)
		ctx.out.line(`const ${childrenVar}: string[] = []`)
		const outerBuffer = ctx.buffer
		ctx.buffer = childrenVar
		for (const child of node.children) emit(ctx, child, scope)
		ctx.buffer = outerBuffer
		args.push(`children: ${childrenVar}.join('')`)
	}
	// The reserved `i18n` record (ADR 0030 sub-design 2, LT-173): the
	// compiler supplies it at every render call boundary — callers
	// never author it (a caller-authored `i18n` attribute is rejected
	// in classify-attributes). Locale precedence (ADR 0030 sub-design
	// 3 as amended by LT-191): the compose site's own `lang` arg, else
	// the PARENT'S effective locale — compose-graph inheritance, the
	// SSR analog of the DOM ancestor walk, since the composition tree
	// is the rendered ancestor chain — else the child's authored
	// default, else `i18nRecord`'s page-locale fallback.
	if (entry.declaresI18n) {
		ctx.usedI18nRecord = true
		const langAttr = node.attrs.find(
			(a): a is Extract<(typeof node.attrs)[number], { kind: 'arg' }> =>
				a.kind === 'arg' && a.name === 'lang',
		)
		const parentLang =
			ctx.component.declaresI18n && ctx.component.langBinding !== null
				? ctx.component.langBinding
				: null
		const langExpr =
			langAttr !== undefined
				? langAttr.exprText
				: parentLang !== null
					? parentLang
					: entry.langArgDefault !== null
						? jsString(entry.langArgDefault, 'double')
						: null
		const tag = jsString(entry.tag, 'double')
		args.push(
			langExpr !== null
				? `i18n: ${ctx.h('i18nRecord')}(${tag}, ${langExpr})`
				: `i18n: ${ctx.h('i18nRecord')}(${tag})`,
		)
	}
	// LT-090: materialize compose-site class/id/data-* on the child root
	// so the discriminator the client selector relies on (e.g.
	// `first('form-spinbutton.lightness')`) exists in the served DOM.
	// Values pass through as the authored expressions — static string
	// literals AND server-evaluable dynamic ones — evaluated at render
	// time in this module's scope, exactly like any other arg. Only a
	// static value is ever a discriminator candidate (`composeStaticAttrs`
	// reads literals only); a dynamic one is render-only (LT-320).
	const hostAttrs = node.attrs.filter(
		(a): a is Extract<typeof a, { kind: 'arg' }> =>
			a.kind === 'arg' && isComposeHostAttr(a.name),
	)
	const extra = opts.extraHostAttrs ?? []
	// The region owner (ADR 0048 s1): this component's tag when it writes
	// the content, its own owner when the content is its `{children}`
	// passed straight through. Only a child that inserts `children` takes
	// one, and only content gives it a region to mark.
	const owner =
		entry.childrenRegion && node.children.length > 0
			? ctx.childrenOwner && ctx.childrenInsertions.forwards.has(node)
				? ctx.childrenOwner
				: jsString(ctx.component.tag, 'double')
			: null
	const renderCall = `render${entry.name}({ ${args.join(', ')} }${owner ? `, ${owner}` : ''})`
	if (hostAttrs.length > 0 || extra.length > 0) {
		ctx.used.add('composeHostAttrs')
		const attrsArg = [
			...hostAttrs.map(a => [a.name, a.exprText] as const),
			// Arm-set keys are compiler-synthesized statics (`data-key="ok"`).
			...extra.map(a => [a.name, jsString(a.value ?? '', 'double')] as const),
		]
			.map(([name, expr]) => `${jsString(name, 'double')}: ${expr}`)
			.join(', ')
		push(
			ctx,
			`${ctx.h('composeHostAttrs')}(${renderCall}, ${jsString(entry.tag, 'double')}, { ${attrsArg} })`,
		)
	} else {
		push(ctx, renderCall)
	}
}

/**
 * The async boundary form of `@try` (ADR 0024 sub-design 13, LT-012; ADR
 * 0037 s4, LT-276): the arm that won at render time renders live, keyed
 * `ok`/`nil`/`err` by its root's `data-key`, followed by one inert
 * `<template data-arms data-key>` per arm. The client's `reconcile()` adopts
 * the winner and clones the other arms as the task settles — only one arm is
 * ever in the document, so no named control in another arm can submit and
 * no fieldset or `hidden` sweep is needed. The analysis already proved each
 * arm is a single root element and found the guarded signal. There is no
 * `stale` arm — the owner withdrew the four-arm spelling (LT-211); a
 * re-fetching task keeps its `ok` arm, and the reactive idiom for the
 * in-flight state is an `isPending(signal)` read beside the boundary, which
 * folds right here (the harness answers it).
 */
const emitAsyncBoundary = (
	ctx: EmitContext,
	node: TryNode,
	scope: ReadonlySet<string>,
): void => {
	// The dispatcher routes here only for the async form (a `@pending`
	// arm exists).
	const pendingChildren = node.pendingChildren
	if (pendingChildren === null) return
	const asyncId = ++ctx.armCounter
	const stateVar = ctx.mint(`__async${asyncId}`)
	const errVar = ctx.mint(`__async${asyncId}Err`)
	const rootOf = (children: TemplateNode[]): BoundaryArmRoot =>
		children.find(isBoundaryArmRoot) as BoundaryArmRoot
	const okRoot = rootOf(node.children)
	const pendingRoot = rootOf(pendingChildren)
	const errRoot = rootOf(node.catchChildren)
	const signalChild = okRoot.children.find(
		(c): c is TemplateNode & { kind: 'expr' } =>
			c.kind === 'expr' &&
			c.reactivity === 'reactive' &&
			c.expr.type === 'Identifier',
	)
	// The driver's name, child channel or the `truc:html` thunk channel
	// (LT-449) — the analysis admitted exactly one, so mirror its choice.
	const signalName = signalChild
		? String((signalChild.expr as AstNode).name)
		: (htmlThunkSignalName(okRoot) ?? '')
	const errScope = new Set(scope)
	if (node.catchParam) errScope.add(node.catchParam)
	// An arm root, with its recognized lazy child (the guarded signal; the
	// catch param or a member read over it) written as `value`: the live
	// winner's resolved value or error text, and nothing in a template —
	// the client's arm mount writes it. A compose root (LT-460) lowers as
	// a compose site: `data-key` and the arm marker attributes splice onto
	// the child's rendered root via `composeHostAttrs`, and the composed
	// content — the message element and its catch-parameter read — emits
	// through the generic paths (in scope live, baked empty in templates).
	const emitArmRoot = (
		root: BoundaryArmRoot,
		armScope: ReadonlySet<string>,
		value: string | null,
		extraAttrs: Array<AttributeIR & { kind: 'static' }> = [],
	): void => {
		if (root.kind === 'compose') {
			emitCompose(ctx, root, armScope, { extraHostAttrs: extraAttrs })
			return
		}
		emitElement(ctx, root, armScope, extraAttrs)
		for (const child of root.children) {
			if (child.kind === 'expr' && child.reactivity === 'reactive') {
				if (value === null) continue
				// `value` starts with the child's own text — the signal of
				// `{data}` read as `data.get()`, the catch parameter's read
				// verbatim — so the child's slice locates it.
				pushText(ctx, ctx.out, 'text', value, child)
				continue
			}
			emit(ctx, child, armScope)
		}
		pushClose(ctx, root.tag)
	}
	// The inert arm templates, one per arm.
	const templates = (): void => {
		const armSet = String(armSetOf(ctx.component.root, node))
		for (const [key, root, armScope] of [
			['ok', okRoot, scope],
			['nil', pendingRoot, scope],
			['err', errRoot, errScope],
		] as const) {
			push(
				ctx,
				`${new HtmlWriter()
					.static('<template')
					.attr('data-arms', armSet)
					.attr('data-key', key)
					.static('>')}`,
			)
			// LT-385c: same rule as the conditional's templates — client-written
			// sites bake empty in the boundary's arms too (a pending task's
			// `get()` would throw); the mounts write them on enter.
			const wasInTemplate = ctx.inArmTemplate
			ctx.inArmTemplate = true
			emitArmRoot(root, armScope, null)
			ctx.inArmTemplate = wasInTemplate
			push(ctx, "'</template>'")
		}
	}
	// Inside a template (an arm's, a list item's; LT-424) nothing is live:
	// the arm templates only — the clone's mount picks the arm.
	if (ctx.inArmTemplate) {
		templates()
		return
	}
	ctx.used.add('isPending')
	ctx.out
		.line(`let ${stateVar}: 'pending' | 'ok' | 'err' = 'pending'`)
		.line(`let ${errVar}: unknown = undefined`)
		.open(`if (!${ctx.h('isPending')}(${signalName})) {`)
		.open('try {')
		.line(`${signalName}.get()`)
		.line(`${stateVar} = 'ok'`)
		.between('} catch (e) {')
		.line(`${errVar} = e`)
		.line(`${stateVar} = 'err'`)
		.close()
		.close()
	const keyed = (key: string): Array<AttributeIR & { kind: 'static' }> => [
		{ kind: 'static', name: 'data-key', value: key },
	]
	const errChild =
		errRoot.children.find(
			(c): c is TemplateNode & { kind: 'expr' } =>
				c.kind === 'expr' && c.reactivity === 'reactive',
		) ??
		// The nested message element's lazy child (LT-449) — the live err
		// arm emits it through the general element emission, which
		// evaluates `error.message` with the catch parameter in scope.
		lazyCatchMessageEl(errRoot, node.catchParam)?.children.find(
			(c): c is TemplateNode & { kind: 'expr' } =>
				c.kind === 'expr' && c.reactivity === 'reactive',
		)
	ctx.out.open(`if (${stateVar} === 'ok') {`)
	emitArmRoot(okRoot, scope, `${signalName}.get()`, keyed('ok'))
	ctx.out.between(`} else if (${stateVar} === 'err') {`)
	// Typed as the authored arm types it (`err: Error`, LT-208), so the
	// catch arm's text (`{e.message}`) typechecks in the server module.
	if (node.catchParam)
		ctx.out.line(`const ${node.catchParam} = ${errVar} as Error`)
	emitArmRoot(
		errRoot,
		errScope,
		errChild ? errChild.exprText : null,
		keyed('err'),
	)
	ctx.out.between('} else {')
	emitArmRoot(pendingRoot, scope, null, keyed('nil'))
	ctx.out.close()
	templates()
}

/**
 * The server expression a reactive conditional's test folds to, or null
 * when no server phase can evaluate it (`initialFold`): the test itself
 * when the value harness can evaluate it, else the test with each
 * `host.<prop>` read spliced for the prop's server seed (`hostSeedExpr` —
 * the parser applied to the root attribute for a Parser-backed prop,
 * LT-386).
 */
const serverTestExpr = (
	ctx: EmitContext,
	node: ConditionalNode,
	scope: ReadonlySet<string>,
): string | null => {
	if (isServerEvaluable(node.test, scope)) return node.testText
	const reads = hostDerivedFold(
		node.test,
		foldableHostProps(ctx.component),
		foldableRefGuards(ctx.component),
		new Set([...ctx.foldScope, ...scope]),
	)
	if (reads === null) return null
	return spliceHostDerivedFold(
		node.testText,
		typeof node.test.start === 'number' ? node.test.start : 0,
		reads,
		(prop, kind) => {
			if (kind === 'ref')
				return foldableRefGuards(ctx.component).get(prop) ?? ''
			const seed = hostSeedExpr(ctx.component, prop)
			if (seed !== null) useSeedNames(ctx, seed)
			return seed ?? ''
		},
	)
}

/**
 * A reactive conditional (ADR 0037 s1): the initial winner renders live,
 * its root keyed by the arm's `data-key`, followed by one inert
 * `<template data-arms data-key>` per arm that renders anything — the
 * client's `reconcile()` adopts the winner by key and clones the rest.
 * The winner folds through the value harness, as every reactive site does;
 * a compile-time constant renders unconditionally, and an unresolvable
 * test renders no live arm (ADR 0037 s5). The analysis proved each
 * rendering arm has one root element, beside client-only statements.
 */
const emitReactiveConditional = (
	ctx: EmitContext,
	node: ConditionalNode,
	scope: ReadonlySet<string>,
): void => {
	// A compose site is an arm root too (LT-460): its rendered root is the
	// child's own element, keyed through `composeHostAttrs`.
	const rootOf = (arm: ArmTemplate): BoundaryArmRoot | undefined =>
		arm.children.find(isBoundaryArmRoot)
	const renderLive = (arm: ArmTemplate | undefined): void => {
		const root = arm && rootOf(arm)
		if (!arm || !root) return
		if (root.kind === 'compose') {
			emitCompose(ctx, root, scope, {
				extraHostAttrs: [{ kind: 'static', name: 'data-key', value: arm.key }],
			})
			return
		}
		emitPlainElement(ctx, root, scope, [
			{ kind: 'static', name: 'data-key', value: arm.key },
		])
	}
	const initial = node.initial
	const test = 'constant' in initial ? null : serverTestExpr(ctx, node, scope)
	// Inside a template (an arm's, a list item's; LT-424) nothing is live:
	// the clone's mount picks the arm.
	if (ctx.inArmTemplate) {
		// no live arm
	} else if ('constant' in initial)
		renderLive(node.arms.find(arm => arm.key === initial.constant))
	else if (test !== null && isIf(node)) {
		ctx.out.open(`if (${test}) {`)
		renderLive(node.arms[0])
		if (elseOf(node).length > 0) {
			ctx.out.between('} else {')
			renderLive(node.arms[1])
		}
		ctx.out.close()
	} else if (test !== null) {
		ctx.out.open(`switch (${test}) {`)
		for (const arm of node.arms) {
			ctx.out.open(
				`${arm.testText === null ? 'default' : `case ${arm.testText}`}: {`,
			)
			renderLive(arm)
			ctx.out.line('break').close()
		}
		ctx.out.close()
	}
	const armSet = String(armSetOf(ctx.component.root, node))
	for (const arm of node.arms) {
		const root = rootOf(arm)
		if (!root) continue
		push(
			ctx,
			`${new HtmlWriter()
				.static('<template')
				.attr('data-arms', armSet)
				.attr('data-key', arm.key)
				.static('>')}`,
		)
		// LT-385c: the losing arms bake client-written sites empty — their
		// condition did not hold at render time. The live winner above keeps
		// its values.
		const wasInTemplate = ctx.inArmTemplate
		ctx.inArmTemplate = true
		if (root.kind === 'compose') emitCompose(ctx, root, scope)
		else emitPlainElement(ctx, root, scope)
		ctx.inArmTemplate = wasInTemplate
		push(ctx, "'</template>'")
	}
}

/**
 * The template emitter dispatcher (LT-225): one arm per `TemplateNode`
 * kind, with the two standalone branches (`emitAsyncBoundary`,
 * `emitCompose`) split out. The element tail resolves reactive-`@for`
 * output nodes to their loop and dispatches plain elements. Depth is the
 * markup builder's: a block's children are emitted between its `open()`
 * and `close()`.
 */
const emit = (
	ctx: EmitContext,
	node: TemplateNode,
	scope: ReadonlySet<string>,
	/** Set by the loop emitters, which render their own empty arm. */
	emptyArm = false,
): void => {
	if (!emptyArm && ctx.emptyArmNodes.has(node)) return
	if (node.kind === 'client-stmt') {
		// Client-only side effect beside conditionally rendered markup
		// (`internals?.states.add('clearable')`) — the server never runs
		// connect-time DOM/ElementInternals APIs, so this renders nothing.
		return
	}
	if (node.kind === 'text') {
		push(ctx, jsString(node.value, 'double'))
		return
	}
	if (node.kind === 'expr') {
		// The reserved `{children}` insertion point (ADR 0024 sub-design 10,
		// LT-018): a composed call already rendered this component's own
		// children into an HTML string — trusted, compiler-generated markup,
		// not user input, so it renders UNESCAPED here (analogous to the
		// MANAGED_TEXT_PROPS/host-prop-mirror special-casing above).
		if (isChildrenInsertion(node)) {
			push(ctx, 'String(children)')
			return
		}
		// LT-385c: inside an arm template a lazy (client-written) site bakes
		// empty — the server has no initial value for it under the arm's
		// condition; the mount writes it on enter.
		if (node.reactivity === 'reactive' && ctx.inArmTemplate) return
		// The bare `{item}` fill of a reactive list reads the item cell.
		const value =
			node.expr.type === 'Identifier' && ctx.listItems.has(node.exprText)
				? { expr: `${node.exprText}.get()`, thunk: false }
				: node.reactivity === 'reactive'
					? lazyValueExpression(
							ctx.component,
							node.exprText,
							node.expr,
							scope,
							ctx.foldScope,
							seed => useSeedNames(ctx, seed),
						)
					: { expr: node.exprText, thunk: false }
		// An authored arrow is `textOf`'s argument, anything else `text`'s.
		pushText(ctx, ctx.out, value.thunk ? 'textOf' : 'text', value.expr, node)
		return
	}
	if (node.kind === 'conditional' && node.mode === 'reactive') {
		emitReactiveConditional(ctx, node, scope)
		return
	}
	if (isIf(node)) {
		// The condition is server-known (validated at lowering) — the
		// render function evaluates it against the real args.
		ctx.out.open(`if (${node.testText}) {`)
		for (const child of thenOf(node)) emit(ctx, child, scope)
		if (elseOf(node).length > 0) {
			ctx.out.between('} else {')
			for (const child of elseOf(node)) emit(ctx, child, scope)
		}
		ctx.out.close()
		return
	}
	if (node.kind === 'conditional') {
		// Arms are mutually exclusive — each case block breaks so JS
		// fall-through cannot blend arms.
		ctx.out.open(`switch (${node.testText}) {`)
		for (const arm of node.arms) {
			ctx.out.open(
				`${arm.testText === null ? 'default' : `case ${arm.testText}`}: {`,
			)
			for (const child of arm.children) emit(ctx, child, scope)
			ctx.out.line('break').close()
		}
		ctx.out.close()
		return
	}
	if (node.kind === 'try' && node.pendingChildren !== null) {
		emitAsyncBoundary(ctx, node, scope)
		return
	}
	if (node.kind === 'try') {
		// Render-time error boundary. Arms render into an isolated
		// buffer so a throw mid-arm (after partial pushes) cannot leak
		// markup into the output — the catch arm starts fresh. The join
		// targets the OUTER buffer; arm names are unique so a nested @try
		// contributes through its own buffer, never shadowing.
		const armName = ctx.mint(`__arm${++ctx.armCounter}`)
		ctx.out.open('try {').line(`const ${armName}: string[] = []`)
		const outerBuffer = ctx.buffer
		ctx.buffer = armName
		for (const child of node.children) emit(ctx, child, scope)
		ctx.buffer = outerBuffer
		ctx.out.line(`${outerBuffer}.push(${armName}.join(''))`)
		if (node.catchChildren.length > 0) {
			ctx.out.between(
				`} catch${node.catchParam ? ` (${node.catchParam})` : ''} {`,
			)
			const catchName = ctx.mint(`__arm${++ctx.armCounter}`)
			ctx.out.line(`const ${catchName}: string[] = []`)
			ctx.buffer = catchName
			const catchScope = new Set(scope)
			if (node.catchParam) catchScope.add(node.catchParam)
			for (const child of node.catchChildren) emit(ctx, child, catchScope)
			ctx.buffer = outerBuffer
			ctx.out.line(`${outerBuffer}.push(${catchName}.join(''))`)
		}
		ctx.out.close()
		return
	}
	if (node.kind === 'compose') {
		emitCompose(ctx, node, scope)
		return
	}
	const loop = [...ctx.component.fors.values()].find(f => f.output === node)
	if (loop) {
		emitFor(ctx, loop, scope)
		return
	}
	emitPlainElement(ctx, node, scope)
}

/**
 * A plain element and its subtree, with `extraAttrs` ahead of its own (a
 * reactive arm's `data-key`).
 */
const emitPlainElement = (
	ctx: EmitContext,
	node: ElementNode,
	scope: ReadonlySet<string>,
	extraAttrs: AttributeIR[] = [],
): void => {
	emitElement(ctx, node, scope, extraAttrs)
	// truc:html={dataRef} renders as sanitized raw children before authored
	// children (dependency-provable, else omitted for the client pass).
	const htmlAttr = node.attrs.find(a => a.kind === 'html') as
		| Extract<AttributeIR, { kind: 'html' }>
		| undefined
	if (htmlAttr && isServerEvaluable(htmlAttr.node, scope)) {
		ctx.used.add('sanitizeHtml')
		push(ctx, `${ctx.h('sanitizeHtml')}(String(${htmlAttr.exprText}))`)
	}
	for (const child of node.children) emit(ctx, child, scope)
	pushClose(ctx, node.tag)
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
	options: {
		runtimeImport: string
		sourcePath: string
		/**
		 * Composed (PascalCase) elements' targets, keyed by resolved `.tsrx`
		 * source path (ADR 0024 sub-design 10). A compose node whose `source`
		 * is missing here was already diagnosed as an error upstream
		 * (`index.ts`), so `emitCompose` never needs to handle a missing entry.
		 */
		composeRegistry?: ReadonlyMap<string, InternalRegistryEntry> | undefined
		/**
		 * The component's evaluation tier (ADR 0029 sub-design 4, LT-165).
		 * Defaults to `'folded'`, which is the pre-LT-165 behaviour — every
		 * caller that does not classify gets the full re-declaration.
		 *
		 * Only the Folded tier re-declares the `@{ }` value-harness
		 * constructs; see `harnessSuppressed` below for what the other two
		 * tiers drop and, deliberately, what they keep.
		 *
		 * This is the component's tier BEFORE compose contamination
		 * (`index.ts` classifies, `server/effects/compile.ts` runs the corpus
		 * fixpoint afterwards). A contaminated component is therefore emitted
		 * on the Folded path even though it ends up Simulated — harmless, and
		 * deliberate: contamination fires on a parent whose OWN setup the
		 * harness can still run, so the skeleton is merely richer than its
		 * tier requires, and the realm re-renders it regardless.
		 */
		tier?: EvaluationTier | undefined
		/**
		 * The message keys client positions read (`ClientPlan.clientMessageKeys`,
		 * LT-218). Non-empty renders the root `i18n` attribute.
		 */
		clientMessageKeys?: readonly string[] | undefined
	},
): EmittedServerModule => {
	const renderScope = renderScopeNames(component)
	const mint = (name: string): string => {
		let local = name
		while (renderScope.has(local)) local = `_${local}`
		return local
	}
	const htmlBuffer = mint('__html')
	const childrenInsertions = childrenInsertionsOf(component.root)
	const childrenOwner =
		childrenInsertions.holders.size > 0 || childrenInsertions.forwards.size > 0
			? mint('__owner')
			: null
	const ctx: EmitContext = {
		component,
		composeRegistry: options.composeRegistry,
		// The markup statements sit at the render function body's depth.
		out: new CodeBuilder({ depth: 1 }),
		used: new Set<string>(),
		composeImports: new Map<string, string>(),
		buffer: htmlBuffer,
		emptyArmNodes: new Set(
			[...component.fors.values()].flatMap(loop => loop.emptyArm ?? []),
		),
		emptyCounter: 0,
		armCounter: 0,
		childrenCounter: 0,
		childrenOwner,
		childrenInsertions,
		usedI18nRecord: false,
		foldScope: foldableRenderScope(component),
		inArmTemplate: false,
		templateUnbound: new Set(),
		listItems: new Set(),
		listFlags: new Map(),
		witnesses: new Map(),
		h: name => (renderScope.has(name) ? mint(`__${name}`) : name),
		mint,
	}
	// The emitters mutate these in place and never rebind them, so the
	// assembly tail binds the identities directly; the mutable scalars
	// (`buffer`, the counters, `usedI18nRecord`) stay
	// ctx-only.
	const { out, used, composeImports } = ctx
	const { lines } = out

	declareListFlags(ctx)
	declareWitnesses(ctx)
	for (const child of component.root.children)
		emit(ctx, child, component.serverKnown)
	emitListTemplates(ctx)
	checkWitnesses(ctx)

	// Root element opening: only static and server-definitive attributes
	// render; reactive/event/ref constructs on the root are the client
	// analyzer's to diagnose.
	const rootHtml = new HtmlWriter().static(`<${component.tag}`)
	const attrCall = (name: string, value: string): string =>
		`${ctx.h('attr')}(${jsString(name)}, ${value})`
	for (const attr of component.root.attrs) {
		if (attr.kind === 'static') rootHtml.attr(attr.name, attr.value)
		else if (attr.kind === 'server') {
			used.add('attr')
			rootHtml.expr(attrCall(attr.name, attr.exprText))
		} else if (attr.kind === 'style-map') {
			// LT-028: the root's reactive style is the one construct the client
			// analyzer accepts (targeting `host`) — render its initial value here
			// the same way `class-map` does for descendants.
			if (isServerEvaluable(attr.object, component.serverKnown)) {
				used.add('attr')
				used.add('styleAttr')
				rootHtml.expr(
					attrCall(
						'style',
						`${ctx.h('styleAttr')}((${attr.thunkText})()) || null`,
					),
				)
			}
		} else if (attr.kind === 'class-map') {
			// LT-032: same root exemption as style-map — render the initial
			// class list here, the same way `class-map` does for descendants.
			if (isServerEvaluable(attr.object, component.serverKnown)) {
				used.add('attr')
				used.add('cls')
				rootHtml.expr(
					attrCall('class', `${ctx.h('cls')}((${attr.thunkText})()) || null`),
				)
			}
		}
	}
	// ADR 0030 sub-design 3 (LT-173 step 2): the EFFECTIVE locale renders
	// onto the root `lang` attribute. When the component declares the
	// reserved `i18n` parameter and binds a `lang` it does not render
	// itself, the compiler renders it here — the root IS the host, so a
	// value rendered there is the channel, not a duplicate copy (ADR 0024
	// sub-design 3's root-attribute exclusion; confirmed: no new LTC039
	// exemption is needed, because `reportDuplicatedChannels` already skips
	// the root element outright).
	if (
		component.declaresI18n &&
		component.langBinding !== null &&
		!component.root.attrs.some(a => 'name' in a && a.name === 'lang')
	) {
		used.add('attr')
		rootHtml.expr(attrCall('lang', component.langBinding))
	}
	// ADR 0030 s9 (LT-218): the client message channel. The render call's
	// own `t` serializes the client-referenced keys the locale changes
	// against the preamble's source record, so each locale bakes its own
	// messages and a composed child inherits the parent's record
	// unchanged. No keys, no attribute: every other component renders
	// byte-identical. The locale is not in the messages (ADR 0030 s6):
	// a component whose client messages format, and that renders no `lang`
	// of its own, gets the render locale on its root.
	const tBinding = component.messageTBindings?.[0]
	const clientKeys = options.clientMessageKeys ?? []
	if (clientKeys.length > 0 && tBinding) {
		const { source, withArgs } = clientSourceRecord(
			component.i18nMessages,
			clientKeys,
		)
		const keysText = jsData(clientKeys)
		const formats = [
			...carriedKinds([...withArgs].map(key => source[key] as Message)),
		].some(kind => FORMATTING_KINDS.has(kind))
		const rendersLang =
			(component.declaresI18n && component.langBinding !== null) ||
			component.root.attrs.some(a => 'name' in a && a.name === 'lang')
		used.add('attr')
		if (formats && !rendersLang) {
			used.add('clientLocale')
			rootHtml.expr(
				attrCall('lang', `${ctx.h('clientLocale')}(${tBinding}, ${keysText})`),
			)
		}
		used.add('clientMessages')
		rootHtml.expr(
			attrCall(
				'i18n',
				`${ctx.h('clientMessages')}(${tBinding}, ${keysText}, ${jsData(source)})`,
			),
		)
	}
	// The root encloses a `{children}` insertion directly: it is the
	// region's marked element (ADR 0048 s1).
	if (childrenOwner && childrenInsertions.holders.has(component.root)) {
		used.add('attr')
		rootHtml.expr(attrCall(CHILDREN_MARKER, childrenOwner))
	}
	rootHtml.static('>')
	const rootMarkup = `${rootHtml}`

	/**
	 * ADR 0029 sub-design 4: only the Folded tier re-declares the `@{ }`
	 * value harness. A Simulated-tier module emits the skeleton and leaves
	 * the rest to the realm; a Static-tier module emits the same skeleton and
	 * leaves the rest to the client.
	 *
	 * **The skeleton and the harness are not separable layers** — the folded
	 * markup IS partly the harness's output, so "emit the skeleton, drop the
	 * setup" cannot be implemented as the ADR words it. `lazyValueExpression`
	 * emits `<name>.get()` straight into the markup, so a folded signal is not
	 * dead code server-side: dropping its declaration leaves the generated
	 * module referencing an undeclared name (`TS2304` under `check:corpus`).
	 *
	 * One criterion replaces the layer split: **retain a setup statement when
	 * the emitted markup depends on its declared name, transitively; drop the
	 * rest.** Plain consts fall out of it (`form-combobox`'s `inputId` reaches
	 * `<label for>`, `<input id>`, `<p id>` and `aria-describedby`, and nothing
	 * downstream restores them), folded signals fall out of it, and `expose()`
	 * is dropped by the same rule rather than by name — it declares nothing, and
	 * an exposed-prop lazy child resolves through the prop→signal map at COMPILE
	 * time to a literal, so no markup expression ever references it.
	 * [Architect ruling, 2026-09-06 (LT-182); ADR 0029 s4 carries the matching
	 * correction.]
	 *
	 * The test is a word-boundary match against the generated code, which is
	 * not a proxy — the question is literally "does this module need this
	 * binding to resolve", and the generated text is the thing that must
	 * resolve. Over-retention (a name that also appears inside a static string
	 * literal) costs a surviving dead const, which is the Folded behaviour
	 * anyway; under-retention cannot happen, because a genuine reference
	 * appears verbatim in the emitted code.
	 */
	const harnessSuppressed = (options.tier ?? 'folded') !== 'folded'
	/**
	 * LT-165 step 5: statements the value harness can never evaluate — they
	 * read a client-only primitive (`first`/`all`/`watch`/…) or a
	 * `first()`-bound ref (the retired `LTC013`/`LTC043` shapes). The
	 * retention rule keeps what the emitted code references, and its token
	 * match cannot tell a genuine reference from a word that happens to
	 * appear in one — `<c-el>` tokenises as containing `el`. Over-retaining
	 * a harness-evaluable const is the Folded behaviour (dead, harmless);
	 * over-retaining one of THESE breaks the module, because the name it
	 * reads exists only in the factory. So the suppressed tiers exclude them
	 * from the retention pool outright: the ADR-0029-s4 criterion retains
	 * only what can actually run server-side, and a markup site genuinely
	 * derived from such a name is an unsound shape that surfaces as a
	 * source-mapped tsc failure on the generated module instead.
	 */
	const refNames = declaredRefNames(component.firstRefs)
	// A `requestContext` statement is NOT excluded by the primitive check
	// below: the primitive's name appears in its free identifiers, but the
	// emitted form substitutes `createCell(fallback)` for the whole call and
	// the fallback is enforced server-known (LTC016) — the harness evaluates
	// it fine (card-mediaqueries folds all four context signals into markup).
	const requestContextNames = new Set(
		component.signals
			.filter(signal => signal.family === 'context')
			.map(signal => signal.name),
	)
	const serverUnevaluable = (stmt: SetupStmt): boolean =>
		stmt.name !== null &&
		!requestContextNames.has(stmt.name) &&
		[...freeIdentifiers(stmt.node)].some(
			name => CLIENT_ONLY_PRIMITIVES.has(name) || refNames.has(name),
		)
	const emittedSetup = harnessSuppressed
		? retainReferenced(
				component.setup.filter(stmt => !serverUnevaluable(stmt)),
				[rootMarkup, ...lines],
			)
		: dropUnreferencedUnevaluable(component.setup, serverUnevaluable, [
				rootMarkup,
				...lines,
			])
	const emittedNames = new Set(
		emittedSetup.map(stmt => stmt.name).filter(name => name !== null),
	)
	// A signal declaration reading `host` folds each read for the prop's
	// server seed (LT-451): the parser applied to the root attribute, the
	// same splice a reactive site's fold makes (`hostSeedExpr`). One with no
	// server truth is `unresolvable` (`assemble-ir.ts`) and stays verbatim —
	// no emitted site reads it, so the retention rule keeps it only for a
	// dependent declaration. A `harvest()` read-through folds per slice.
	const foldable = foldableHostProps(component)
	const hostFolded = new Map<SetupStmt, NonNullable<SetupStmt['slices']>>()
	for (const stmt of emittedSetup) {
		const signal = component.signals.find(s => s.name === stmt.name)
		if (signal?.family !== 'declared' || signal.unresolvable) continue
		const reads = initializerHostReads(stmt.node, foldable)
		if (!reads?.length) continue
		const pieces = stmt.slices ?? [{ text: stmt.text, start: stmt.range.start }]
		hostFolded.set(
			stmt,
			pieces.map(piece => ({
				text: spliceHostDerivedFold(
					piece.text,
					piece.start,
					reads.filter(
						r =>
							r.start >= piece.start &&
							r.end <= piece.start + piece.text.length,
					),
					prop => {
						const seed = hostSeedExpr(component, prop) ?? ''
						useSeedNames(ctx, seed)
						return seed
					},
				),
				start: piece.start,
			})),
		)
	}

	for (const signal of component.signals) {
		// A signal whose declaration the markup does not reference is not
		// emitted, so its constructor must not be imported either. Hygiene,
		// not a gate: `check:corpus` runs `tsc` under the project's
		// `noUnusedLocals: false`, and the plain `imports.server` lines are
		// emitted unconditionally anyway, so orphaned imports are survivable
		// in every tier (the Folded baseline carries more of them than the
		// suppressed tiers do). What is NOT survivable is the reverse — a
		// dropped declaration whose name survives in the markup, which is the
		// `TS2304` this rule exists to prevent.
		if (!emittedNames.has(signal.name)) continue
		// requestContext-declared signals (LT-035): `requestContext` doesn't
		// exist server-side (no `host` to dispatch a context-request against)
		// — the setup-statement loop below substitutes `createCell(fallback)`
		// for the whole call, so the runtime import needed is `createCell`,
		// not `requestContext` (which isn't even a `@zeix/le-truc` top-level
		// export — it's a `FactoryContext` member bound per-host).
		if (signal.family === 'context') {
			used.add('createCell')
			continue
		}
		used.add(signal.constructor)
		// A harness export named inside the initializer's OPTIONS —
		// `createItem: createStore` on a reactive list (ADR 0046 s3) — is
		// filtered out of the authored import line by
		// `RUNTIME_HARNESS_EXPORTS` (imports.ts), so the runtime import line
		// must provide it: register every harness name the declaration's own
		// text mentions.
		for (const id of signal.text.match(/[A-Za-z_$][\w$]*/g) ?? [])
			if (RUNTIME_HARNESS_EXPORTS.has(id)) used.add(id)
	}
	// `expose()` declares no name, so the retention rule never keeps it; its
	// runtime import and its ambients go with it.
	if (component.expose && !harnessSuppressed) used.add('expose')
	if (!harnessSuppressed)
		for (const ambient of component.expose?.ambients ?? []) used.add(ambient)

	// Client-only ambients `expose()`'s argument names that the server
	// render function must still declare — see the `refStub` doc in
	// runtime.ts. Computed here, ahead of the import line below, because
	// a stub needs `refStub` imported; emitted further down, in
	// signature order.
	// Suppressing `expose()` suppresses its stubs with it: the `any`-stubs
	// exist only so the dropped call's own free names resolve.
	const { expose } = component
	// A harness export named inside `expose()` (an inline `createSensor(…)`,
	// ADR 0046 s5) binds from the harness: the authored import of it is
	// filtered out server-side, and an `any` stub would refuse its type
	// arguments.
	const exposeHarnessNames =
		expose?.argNode && !harnessSuppressed
			? [...freeIdentifiers(expose.argNode)].filter(
					name =>
						RUNTIME_HARNESS_EXPORTS.has(name) &&
						!component.serverKnown.has(name),
				)
			: []
	for (const name of exposeHarnessNames) used.add(name)
	const stubNames =
		expose?.argNode && !harnessSuppressed
			? [...freeIdentifiers(expose.argNode)]
					.filter(
						name =>
							!JS_GLOBALS.has(name) &&
							name !== 'expose' &&
							!RUNTIME_HARNESS_EXPORTS.has(name) &&
							!component.serverKnown.has(name) &&
							!expose.ambients.includes(name) &&
							// LT-034: a custom Parser factory (e.g. `asOklch`) may now
							// resolve to a real plain import instead — stubbing it as
							// `any` would shadow that import with a broken local const.
							!component.imports.serverLocalNames.has(name),
					)
					.sort()
			: []
	// A shared setup HELPER (`const commit = (next: number) => { … host.value
	// = next … relayValidity(internals, input) }`) is dead code server-side
	// for exactly the same reason a `defineMethod` body is — defined, never
	// called — but its free context members still have to RESOLVE for the
	// module to type-check. `host` usually rides in on `expose()`'s argument;
	// `internals` need not, and did not once form-spinbutton's commit path
	// was extracted out of `expose()` (LT-118).
	//
	// Deliberately narrow: only the two context MEMBERS, never refs. A ref
	// stub that is merely declared is fine, but one whose value reaches the
	// markup renders an empty string where the author asked for a DOM read —
	// a build error traded for a silently wrong page (see LT-125). A context
	// member cannot reach the markup: it is never server-known at all.
	const setupContextNames = new Set<string>()
	for (const stmt of emittedSetup)
		for (const name of freeIdentifiers(stmt.node))
			if (
				(name === 'host' || name === 'internals') &&
				!component.serverKnown.has(name)
			)
				setupContextNames.add(name)
	const stubNamesAll = [...new Set([...stubNames, ...setupContextNames])].sort()
	if (stubNamesAll.length > 0) used.add('refStub')

	// `isPending` is harness-provided (LT-211): an authored import of it is
	// filtered out server-side (RUNTIME_HARNESS_EXPORTS), so the module's
	// binding must come from here whenever any emitted position references
	// it — markup lines, the re-declared setup, `expose()`, or the ROOT
	// element's folded attributes (rootParts bypass `lines` and are pushed
	// into the module body only after this scan; the LT-211 review found a
	// root `class={() => ({ dimmed: isPending(data) })}` emitting an unbound
	// reference without this clause). Tokenized like `retainReferenced`
	// (identifier-boundary over the generated text): it can over-retain on
	// a string literal mentioning the name, which at worst adds one unused
	// harness import.
	const referencesIsPending = (scan: string): boolean =>
		/\bisPending\b/.test(scan)
	if (
		lines.some(line => referencesIsPending(line)) ||
		emittedSetup.some(stmt => referencesIsPending(stmt.text)) ||
		(component.expose !== null && referencesIsPending(component.expose.text)) ||
		rootHtml.exprs.some(expr => referencesIsPending(expr))
	)
		used.add('isPending')

	/**
	 * LT-194: the page-occurrence args helper. Emitted when the component
	 * declares the reserved `i18n` parameter — its server bytes are the ones
	 * the locale actually determines — and takes no `children` arg. The page
	 * renderer (`server/effects/page-render.ts`) qualifies an occurrence by
	 * the PRESENCE of this export, so these conditions are the
	 * qualification.
	 *
	 * The mapping mirrors the client's connect-time seeding exactly: a
	 * Parser-backed prop parses its attribute; a plain `string`-annotated arg
	 * takes the raw attribute (the only channel an authored occurrence has);
	 * a non-Parser, non-string arg has NO attribute channel client-side, so
	 * its attribute is ignored, not re-typed. An absent attribute omits the
	 * key only when the pattern marks the arg optional or defaulted —
	 * otherwise the occurrence is unrenderable and the helper returns null
	 * (the renderer leaves it authored and says so). `lang` and `i18n` are
	 * the renderer's to supply: the resolved page-position locale and the
	 * `i18nRecord` at it (ADR 0030 sub-design 3's precedence, rung 1+2).
	 *
	 * A Parser expression is emitted VERBATIM — but only when its fallback
	 * resolves at MODULE scope (LT-290): the helper is a separate export,
	 * so a fallback reading a `first()` ref, a setup const, `host`, or
	 * another arg names a binding that exists only inside the render
	 * function (form-spinbutton's `asNumber(asNumber(0)(input.value))` was
	 * a ReferenceError at page render and 5 × TS2552 in check:corpus).
	 * Declaring the stub in the helper would be worse: a `refStub` value
	 * would reach the markup (LE_TRUC_COMPILER.md § 8). Such a prop has NO
	 * attribute channel here — an occurrence carrying its attribute
	 * returns null (left authored; the renderer records it
	 * `unrenderable-args`), an absent attribute omits the key when the arg
	 * is optional/defaulted, and a required one withholds the whole helper.
	 */
	const resolvesInHelper = (node: AstNode | null): boolean =>
		node === null ||
		[...freeIdentifiers(node)].every(
			name =>
				JS_GLOBALS.has(name) ||
				RUNTIME_HARNESS_EXPORTS.has(name) ||
				component.imports.serverLocalNames.has(name),
		)
	const argsHelperLines: string[] | null =
		// Only components whose SERVER bytes the locale actually determines
		// (the reserved record: folded catalog words and the materialized
		// root `lang`) qualify. A `lang`-arg component
		// without `i18n` (basic-number) renders its locale-dependent value
		// CLIENT-side, so replacing its authored bytes would only empty them.
		component.declaresI18n &&
		!harnessSuppressed &&
		!component.paramNames.includes('children') &&
		// A required arg that is neither Parser-backed nor a plain string has
		// no attribute channel at all (a structured, compose-only arg) — the
		// component is STATICALLY unrenderable from an authored occurrence, so
		// no export is emitted and the renderer never qualifies it.
		component.paramProps.every(param => {
			if (param.name === 'i18n' || param.name === 'lang') return true
			const parser = component.exposeProps.get(param.name)?.parser
			if (parser && !resolvesInHelper(parser.fallbackNode))
				return param.optional || param.hasDefault
			if (parser || param.isString || param.isNumber) return true
			return param.optional || param.hasDefault
		})
			? (() => {
					const stmts: string[] = []
					for (const param of component.paramProps) {
						if (param.name === 'i18n' || param.name === 'lang') continue
						const optionalish = param.optional || param.hasDefault
						const key = jsString(param.name, 'double')
						// The occurrence's attribute is the arg's kebab-case name
						// (`readingTime` ← `reading-time`, LT-095): parse5 reports
						// attribute names lowercased, so a camelCase lookup could
						// never match. A one-word arg is its own attribute name.
						const attrKey = jsString(
							param.name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`),
							'double',
						)
						const attrVar = `${param.name}Attr`
						const parser = component.exposeProps.get(param.name)?.parser
						if (parser && !resolvesInHelper(parser.fallbackNode)) {
							// LT-290: no attribute channel — the gate above proved
							// the arg optional/defaulted, so an absent attribute
							// omits the key and a present one is unrenderable.
							stmts.push(`\tif (attrs[${attrKey}] != null) return null`)
						} else if (parser) {
							stmts.push(`\tconst ${attrVar} = attrs[${attrKey}] ?? null`)
							stmts.push(
								`\tif (${attrVar} !== null) args[${key}] = ${parser.parser}(${parser.fallbackText ?? ''})(${attrVar})`,
							)
							if (!optionalish) stmts.push('\telse return null')
							for (const id of [
								parser.parser,
								...(parser.fallbackText?.match(/[A-Za-z_$][\w$]*/g) ?? []),
							])
								if (RUNTIME_HARNESS_EXPORTS.has(id)) used.add(id)
						} else if (param.isString) {
							// A plain string arg: the raw attribute is the only
							// channel an authored occurrence has.
							stmts.push(`\tconst ${attrVar} = attrs[${attrKey}] ?? null`)
							stmts.push(`\tif (${attrVar} !== null) args[${key}] = ${attrVar}`)
							if (!optionalish) stmts.push('\telse return null')
						} else if (param.isNumber) {
							// A number arg: a blank attribute is absent, a
							// non-numeric one makes the occurrence unrenderable
							// rather than rendering `NaN`.
							stmts.push(
								`\tconst ${attrVar} = attrs[${attrKey}]?.trim() || null`,
							)
							stmts.push(`\tif (${attrVar} !== null) {`)
							stmts.push(
								`\t\tif (!Number.isFinite(Number(${attrVar}))) return null`,
							)
							stmts.push(`\t\targs[${key}] = Number(${attrVar})`)
							stmts.push('\t}')
							if (!optionalish) stmts.push('\telse return null')
						} else {
							// Non-string, non-Parser: no attribute channel
							// client-side either — the attribute is inert on an
							// authored occurrence, so the render ignores it. The
							// gate above proved the arg optional/defaulted.
						}
					}
					return [
						'/**',
						" * Maps an authored page occurrence's attributes to this component's",
						' * server args (LT-194). Null when the occurrence cannot be rendered',
						" * from attributes alone. `lang` and `i18n` are the page renderer's.",
						' */',
						'export function argsFromAttrs(attrs: Record<string, string | null>): Record<string, unknown> | null {',
						'\tconst args: Record<string, unknown> = {}',
						...stmts,
						'\treturn args',
						'}',
					]
				})()
			: null

	const body = new CodeBuilder()
		.line('/**')
		.line(' * Generated by the Le Truc TSRX compiler (milestone 1) from')
		.line(` * ${options.sourcePath} — DO NOT EDIT.`)
		.line(' */')
	if (used.size > 0) {
		const imports = [...used]
			.sort()
			.map(name =>
				importSpecifier(
					name,
					(EMITTED_HARNESS_NAMES as readonly string[]).includes(name)
						? ctx.h(name as EmittedHarnessName)
						: name,
				),
			)
		body.line(
			`import { ${imports.join(', ')} } from ${jsString(options.runtimeImport)}`,
		)
	}
	for (const [name, specifier] of [...composeImports].sort())
		body.line(`import { render${name} } from ${jsString(specifier)}`)
	// ADR 0030 (LT-173): the reserved record's type and constructor live in
	// the generated `i18n` module the corpus effect writes beside these
	// artifacts. Type import when this component declares the parameter;
	// value import when this module composes a child that declares it.
	if (component.declaresI18n) body.line(`import type { I18n } from './i18n'`)
	if (ctx.usedI18nRecord)
		body.line(
			`import { ${importSpecifier('i18nRecord', ctx.h('i18nRecord'))} } from './i18n'`,
		)
	// The `Children<…>` args annotation (ADR 0048 s2) rides the verbatim
	// params slice below; authored type-only imports are dropped (LT-082),
	// so the reference is re-imported here.
	if (component.childrenContract)
		body.line(`import type { Children } from '@zeix/le-truc'`)
	// Authored text and declarations are pre-formatted: appended as written.
	body.append([...component.imports.server, ''])
	for (const decl of component.typeDecls) body.append([decl, ''])
	// Verbatim param slice, re-indented: first line inline in the signature,
	// continuation lines keep their relative shape.
	const paramLines = reindent(
		i18nAnnotated(component.paramsText, component.i18nArgs),
		2,
	).split('\n')
	const paramFirst = paramLines[0]?.replace(/^\t\t/, '') ?? ''
	// The Children Region's owner rides as a second, optional parameter
	// (ADR 0048 s1): a compiled compose site passes it, a page render does
	// not, so a page-rendered instance carries no marker.
	const ownerParam = childrenOwner ? `, ${childrenOwner}?: string` : ''
	if (paramLines.length === 1) {
		body.open(
			`export function render${component.name}(${ownerParam && !paramFirst ? '_args: {} = {}' : paramFirst}${ownerParam}): string {`,
		)
	} else {
		body.line(`export function render${component.name}(${paramFirst}`)
		body.append(paramLines.slice(1)).open(`${ownerParam}): string {`)
	}
	// The client-only ambients computed above: a method-producer body
	// inside expose() (`defineMethod(() => { host.value = ''; input.value
	// = '' })`) closes over context members and refs the server render
	// function never declares, and is dead code server-side
	// (`defineMethod` is identity there, never invoked) — but the module
	// still needs it to TYPE-CHECK (LT-019). `expose()`'s own argument
	// object, unlike those bodies, IS evaluated, so the stub has to
	// survive being read and called, not just resolve (LT-121).
	for (const name of stubNamesAll)
		body.line(`const ${name}: any = ${ctx.h('refStub')}`)
	// Setup statements keep their relative shape: the shallowest continuation
	// line lands at one tab (statement depth), deeper lines keep their
	// relative indent, template-literal interiors stay byte-identical (LT-010).
	// Each statement is also verbatim source, so its span is recorded
	// (LT-011); `append` rebases the spans onto the module.
	const setup = new CodeBuilder({ depth: 1, reindent: true })
	for (const stmt of emittedSetup) {
		// requestContext-declared signals (LT-035): `stmt.text` is the verbatim
		// `requestContext(Context, fallback)` call, which doesn't exist
		// server-side — substitute a `createCell(fallback)` declaration
		// instead, so `.get()` still works the same way any other signal's
		// does for the rest of the server-rendering pipeline (lazy children,
		// reactive attrs). The span still points at the original statement's
		// source range — coarse (the generated text no longer matches
		// character-for-character), same trade-off as the expose.argNode
		// any-stubs above, which aren't span-tracked at all.
		const ctxSignal = component.signals.find(
			(s): s is ContextSignalIR =>
				s.family === 'context' && s.name === stmt.name,
		)
		const folded = hostFolded.get(stmt)
		const stmtText = ctxSignal
			? `const ${ctxSignal.name} = createCell(${ctxSignal.fallbackText})`
			: folded
				? folded.map(slice => slice.text).join('')
				: stmt.text
		// A `harvest()` seed's statement reads the marker through to its seed
		// (ADR 0046 s7), so its slices map around the cut.
		setup.line(
			stmtText,
			(!ctxSignal && (folded ?? stmt.slices)) || [
				{ text: stmtText, start: stmt.range.start },
			],
		)
	}
	body
		.append(setup)
		.line(`const ${htmlBuffer}: string[] = []`)
		.line(`${htmlBuffer}.push(${rootMarkup})`)
		.append(out)
		.line(`${htmlBuffer}.push(${jsString(`</${component.tag}>`)})`)
		.line(`return ${htmlBuffer}.join('')`)
		.close()
	if (argsHelperLines !== null) body.append(['', ...argsHelperLines])

	return {
		code: `${body}\n`,
		runtimeImports: used,
		spans: body.spans,
	}
}
