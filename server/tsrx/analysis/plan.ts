/**
 * Client analysis orchestration and plan vocabulary (LT-022, regrouping
 * move M5 of LE_TRUC_COMPILER.md §7). `analyzeClient` builds an explicit
 * `AnalysisContext` — the shared state and helpers the old ~2,500-line
 * closure web threaded implicitly — and runs the passes in their original
 * order: loops (each/reconcile planning), harvest (render sites + seeding
 * plans), effects (per-construct client lowering), each in its own module
 * and independently testable against a constructed context. Every rewrite
 * rule that cannot be applied reports a diagnostic — these rules are the
 * product (ADR 0024 consequences): a wrong rewrite is a wrong component.
 */

import type { TsrxNode } from '@tsrx/core'
import { CONTEXT_NAMES, freeIdentifiers, JS_GLOBALS } from '../ast-utils'
import type { CompileDiagnostic } from '../diagnostics'
import { dependenciesOf } from '../evaluability'
import type { ComponentIR, ForIR } from '../ir'
import type { RegistryEntry } from '../registry'
import { walkTemplate } from '../walk'
import { runEffects } from './effects'
import { runHarvest } from './harvest'
import { runLoops } from './loops'
import { addQuery } from './naming'

/* === Types === */

export type ParserKind = 'asInteger' | 'asBoolean' | 'asString' | null

/** A generated element query. */
export type QueryPlan = {
	/** Variable name in the generated factory. */
	name: string
	selector: string
	/**
	 * `first(sel, message)` (throws if missing) / `all(sel, message)` / a
	 * non-throwing `first(sel)` for an element that only exists when a
	 * single-branch `@if` (no `@else`) actually rendered it — `message` is
	 * unused for `'maybe'`.
	 */
	cardinality: 'one' | 'many' | 'maybe'
	message: string
}

/** How a signal seeds itself from the server-rendered DOM. */
export type HarvestPlan =
	| {
			kind: 'text'
			signal: string
			/** Query name of the element whose text was rendered. */
			query: string
			parser: ParserKind
	  }
	| {
			kind: 'attr'
			signal: string
			query: string
			attr: string
			parser: ParserKind
	  }
	| {
			kind: 'membership'
			signal: string
			/** Collection query holding the marked elements. */
			collection: string
			/** Attribute the membership thunk renders (`aria-selected`). */
			markAttr: string
			/** Attribute carrying the signal's value (`aria-controls`). */
			valueAttr: string
			default: string
	  }
	| {
			/**
			 * Arg-substituted seed (LT-008): the initializer reads server args
			 * (e.g. `createCell(value.length)`); the client seeds from the
			 * args' rendered DOM sites — the param identifier is replaced by
			 * an element-derived read (DOM-is-truth, ADR 0023 sub-design 3).
			 */
			kind: 'substitute'
			signal: string
			/** Initializer text with param identifiers replaced by DOM reads. */
			expr: string
	  }
	| {
			/** Reactive List reconciled over the adopted DOM (milestone 3). */
			kind: 'list'
			signal: string
			/**
			 * 'verbatim' — the declared seed is a pure literal; the server
			 * rendered from the same seed, so the DOM agrees by construction.
			 * Otherwise the seed is arg-dependent and the client harvests the
			 * container's adopted children (keys regenerate identically).
			 */
			seed: 'verbatim' | { container: string; valueSelector: string }
	  }

/** A hoisted const rebound to a server-rendered attribute inside each(). */
export type RebindingPlan = {
	name: string
	/** Expression for the element-derived value. */
	expr: string
}

export type LoopEffectPlan =
	| {
			kind: 'watch-attr'
			attr: string
			thunkText: string
			/** Number-valued thunks stringify — `bindAttribute` takes string|boolean. */
			coerceToString: boolean
			/** Source range of `thunkText` (LT-011 span table). */
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			kind: 'watch-class'
			keys: string[]
			thunkText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			kind: 'on'
			event: string
			handlerText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }

/** One `@for` over server data lowered to `each()`. */
export type ForClientPlan = {
	/** Collection query variable (`tabs`). */
	collection: string
	/** Element parameter name inside each() (`tab`). */
	itemParam: string
	rebindings: RebindingPlan[]
	effects: LoopEffectPlan[]
}

/** Events on one element inside a reactive-list item, mounted in bindItem. */
export type ReconcileItemEvents = {
	/** bindItem-scoped variable for the element (null target = item root). */
	selector: string | null
	name: string
	message: string
	events: Array<{
		event: string
		handlerText: string
		sourceStart: number | undefined
		sourceEnd: number | undefined
	}>
}

/** One reactive `@for` over a declared List lowered to `reconcile()`. */
export type ReconcilePlan = {
	/** Component tag (query messages). */
	tag: string
	/** Container query variable (`container`). */
	container: string
	/** Extracted-template query variable (`template`). */
	template: string
	/** The declared createList signal (`items`). */
	signal: string
	/** bindItem's item-signal parameter, named after the loop variable. */
	itemParam: string
	/** bindItem's key parameter, from `key k` (null → `_key`). */
	keyParam: string | null
	/** Scoped selector of the element carrying the &{item} hole. */
	holeSelector: string
	itemEvents: ReconcileItemEvents[]
}

export type TopEffectPlan =
	| { kind: 'watch-text'; query: string; source: string }
	| {
			kind: 'watch-attr'
			query: string
			attr: string
			thunkText: string
			dispatch: 'attribute' | 'property'
			/** Number-valued thunks stringify — `bindAttribute` takes string|boolean. */
			coerceToString: boolean
			/** Source range of `thunkText` (LT-011 span table). */
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			kind: 'pass'
			query: string
			prop: string
			thunkText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
			/** `{ get, set }` descriptor's write-back accessor (LT-017). */
			setThunkText: string | undefined
			setSourceStart: number | undefined
			setSourceEnd: number | undefined
	  }
	| {
			kind: 'on'
			query: string
			event: string
			handlerText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			/**
			 * `style={() => ({ … })}` (LT-028): one `watch(thunk, bindStyle(el,
			 * keys))` call against `bindStyle()`'s map-form overload (LT-029) —
			 * every declared CSS property is set from the single evaluated map
			 * in one dispatch. `query` is `'host'` for the component-root case
			 * (LT-028's motivating gap): the target is the ambient `host`, not
			 * a queried descendant.
			 */
			kind: 'watch-style'
			query: string
			keys: string[]
			thunkText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			/**
			 * `class={() => ({ … })}` (LT-031): one `watch(thunk, bindClass(el,
			 * keys))` call against `bindClass()`'s map-form overload (LT-029) —
			 * every declared class token is toggled from the single evaluated
			 * map in one dispatch, mirroring `watch-style`. `query` is `'host'`
			 * for the component-root case (LT-032).
			 */
			kind: 'watch-class'
			query: string
			keys: string[]
			thunkText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			/**
			 * `html={() => …}` (LT-025): one `watch(thunk,
			 * dangerouslyBindInnerHTML(el))` call — the sanctioned XSS-aware
			 * sink (ADR 0010), never a raw `innerHTML` property binding.
			 */
			kind: 'watch-html'
			query: string
			thunkText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| { kind: 'each'; for: ForClientPlan }
	| { kind: 'reconcile'; for: ReconcilePlan }
	| {
			/**
			 * A verbatim client-only statement (`internals?.states.add(…)`)
			 * lowered from a control-flow branch — always wrapped in a
			 * `'guarded'` effect, never emitted bare (see below).
			 */
			kind: 'raw'
			text: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
	  }
	| {
			/**
			 * Effects that only apply when a single-branch `@if` (no `@else`)
			 * actually rendered — `query` was addressed with a non-throwing
			 * `first()`, so the generated `if (query) { … }` block is the
			 * client-side mirror of the server's own `if (cond) { … }`.
			 */
			kind: 'guarded'
			query: string
			effects: TopEffectPlan[]
	  }
	| {
			/**
			 * An async boundary (`@try`/`@pending`/`@catch`, ADR 0023 sub-design
			 * 13, LT-012): one `watch(signal, { ok, err, nil })` call toggles the
			 * three server-rendered roots' `hidden` property — pure enhance, no
			 * client DOM creation, mirroring `module-lazyload.ts`'s hand-written
			 * shape. `okText`/`errText`, when present, are the arm's own lazy
			 * text child — the resolved value for `okQuery`, the error (or a
			 * member expression over it, e.g. `error.message`) for `errQuery`.
			 */
			kind: 'async'
			signal: string
			pendingQuery: string
			okQuery: string
			errQuery: string
			okText: boolean
			errText: string | null
	  }

export type ClientPlan = {
	queries: QueryPlan[]
	harvests: HarvestPlan[]
	effects: TopEffectPlan[]
	/**
	 * Context members the generated factory must destructure (`host`,
	 * `internals`) — collected from every client code position plus the
	 * setup's expose() initializers (compiler.ts `contextRefs`).
	 */
	ambientContext: string[]
	/**
	 * Registry tags this component addresses (ref/pass targets) other than
	 * itself. The generated client side-effect-imports their modules so the
	 * tag-map augmentation is present for the factory's typed queries.
	 */
	childTags: string[]
}

/**
 * The explicit shared state and helpers the analysis passes thread between
 * them — the old `analyzeClient` closure web made concrete. Construct one
 * (via `analyzeClient`, or by hand in tests) and any single pass is
 * independently runnable: `runLoops` populates `forPlans`/`reconcilePlans`,
 * `runHarvest` reads them and fills `harvests`, `runEffects` reads
 * everything and fills `effects`. Queries, diagnostics, ambient context,
 * and name allocation are appended in pass order — the original execution
 * order — so query/diagnostic sequences are byte-stable.
 */
export type AnalysisContext = {
	component: ComponentIR
	source: string
	diagnostics: CompileDiagnostic[]
	registry: ReadonlySet<string>
	/**
	 * Composed (PascalCase) elements' targets, keyed by resolved `.tsrx`
	 * source path (ADR 0023 sub-design 10) — needed only to resolve the
	 * underlying custom-element tag for a `pass={{ }}`-addressed composed
	 * target's query selector text.
	 */
	composeRegistry?: ReadonlyMap<string, RegistryEntry> | undefined
	/** The generated factory's element queries, in registration order. */
	queries: QueryPlan[]
	/** The signals' seeding plans, in component signal order. */
	harvests: HarvestPlan[]
	/** The document-ordered client effect list. */
	effects: TopEffectPlan[]
	/** Registry-child tags addressed (type-flow imports). */
	childTags: Set<string>
	/** Context members the factory must destructure. */
	ambient: Set<string>
	/** Claimed variable names (queries, rebindings; never signals/refs). */
	usedNames: Set<string>
	/** Every `ref={name}` in the template, pre-collected. */
	refNames: Set<string>
	/** Pass 1 output: server-data `@for` → `each()` plans. */
	forPlans: Map<ForIR, ForClientPlan>
	/** Pass 1b output: reactive-list `@for` → `reconcile()` plans. */
	reconcilePlans: Map<ForIR, ReconcilePlan>
	/** Register (or reuse) a query; returns its variable name. */
	addQuery: (
		base: string,
		selector: string,
		cardinality: 'one' | 'many' | 'maybe',
	) => string
	/** Note context members (`host`, `internals`) a client code position reads. */
	collectAmbient: (node: TsrxNode | null | undefined) => void
	/** Free names in a reactive/pass thunk the client cannot resolve. */
	badFreeNames: (node: TsrxNode) => string[]
}

/* === Exported Functions === */

export const analyzeClient = (
	component: ComponentIR,
	registry: ReadonlySet<string>,
	diagnostics: CompileDiagnostic[],
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): ClientPlan => {
	const source = component.source
	const queries: QueryPlan[] = []
	const harvests: HarvestPlan[] = []
	const effects: TopEffectPlan[] = []
	const childTags = new Set<string>()
	const ambient = new Set<string>(component.contextRefs)
	const collectAmbient = (node: TsrxNode | null | undefined): void => {
		if (!node) return
		for (const name of freeIdentifiers(node))
			if (CONTEXT_NAMES.has(name)) ambient.add(name)
	}
	const usedNames = new Set<string>([
		component.tag.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
		...component.signals.map(s => s.name),
		'host',
	])
	// Pre-collect ref names — thunks may reference any ref in the template.
	// Traversal via `walkTemplate` (LT-042): refs are declared on plain and
	// composed elements only, composition is a boundary, and `@pending` arms
	// don't declare refs (async arms are single static roots).
	const refNames = new Set<string>()
	walkTemplate(
		component.root,
		node => {
			if (node.kind !== 'element' && node.kind !== 'compose') return
			for (const attr of node.attrs)
				if (attr.kind === 'ref') refNames.add(attr.name)
		},
		{
			intoCompose: false,
			intoPending: false,
		},
	)

	/** Free names in a reactive/pass thunk the client cannot resolve. */
	const badFreeNames = (node: TsrxNode): string[] =>
		[...dependenciesOf(node)].filter(
			name =>
				!component.signals.some(s => s.name === name) &&
				!refNames.has(name) &&
				!JS_GLOBALS.has(name) &&
				!CONTEXT_NAMES.has(name),
		)

	const ctx: AnalysisContext = {
		component,
		source,
		diagnostics,
		registry,
		composeRegistry,
		queries,
		harvests,
		effects,
		childTags,
		ambient,
		usedNames,
		refNames,
		forPlans: new Map(),
		reconcilePlans: new Map(),
		addQuery: (base, selector, cardinality) =>
			addQuery(
				usedNames,
				queries,
				childTags,
				component,
				registry,
				base,
				selector,
				cardinality,
			),
		collectAmbient,
		badFreeNames,
	}

	runLoops(ctx)
	runHarvest(ctx)
	runEffects(ctx)

	return {
		queries,
		harvests,
		effects,
		ambientContext: [...ambient].sort(),
		childTags: [...childTags].sort(),
	}
}
