/**
 * Client analysis orchestration and plan vocabulary (LT-022, regrouping
 * move M5 of LE_TRUC_COMPILER.md §7). `analyzeClient` builds the typed
 * `PassShared` environment — the order-carrying accumulators the old
 * ~2,500-line closure web threaded implicitly — and runs the passes as
 * functions over it: loops (each/reconcile planning), harvest (render sites
 * + seeding plans), effects (per-construct client lowering), each in its own
 * module, each taking its producers' output as a required parameter (ADR
 * 0040 s5), and independently testable against a constructed environment.
 * Every rewrite rule that cannot be applied reports a diagnostic — these
 * rules are the product (ADR 0024 consequences): a wrong rewrite is a wrong
 * component.
 */

import type { AstNode } from '../ast-node'
import { asArray, freeIdentifiers, identifierName, isNode } from '../ast-utils'
import type { LocalDiagnostic } from '../diagnostics'
import { diagnostic } from '../diagnostics'
import { dependenciesOf } from '../evaluability'
import { staticMessageReads } from '../i18n'
import { computeClientNeededNames, serverUsageNames } from '../imports'
import type {
	ComponentIR,
	EachForIR,
	ItemSetupStmt,
	ReconcileForIR,
	TemplateNode,
} from '../ir'
import type { RegistryEntry } from '../registry'
import type { SuppressedSite } from '../simulation/contract.ts'
import type { LocalRoutingSignal } from '../tier'
import {
	CLIENT_ONLY_PRIMITIVES,
	CONTEXT_NAMES,
	JS_GLOBALS,
} from '../vocabulary'
import { walkTemplate } from '../walk'
import { type ComposeRefs, resolveComposeRefs } from './compose-refs'
import { reportServerOnlyNames, runEffects } from './effects'
import { runHarvest } from './harvest'
import { runLoops } from './loops'
import { addQuery, renderOnlyBindings } from './naming'
import { composedShapesFor } from './selectors'

/* === Types === */

/** The harvest parser an attr/text seed reads through (from `parserForType`). */
export type ParserKind = 'asNumber' | 'asBoolean' | 'asString'

/**
 * An authored parser spliced into the client as written (LT-443): the
 * `harvest(seed, parser)` marker's second argument. A type error in the
 * generated module maps to `start` through the span table.
 */
export type AuthoredParser = {
	kind: 'authored'
	/** The parser expression, as authored. */
	text: string
	/** Where the expression starts in the authored source. */
	start: number
	/** Whether the call needs parentheses around `text` (an arrow, an operator). */
	wrap: boolean
}

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
			parser: ParserKind | AuthoredParser
	  }
	| {
			kind: 'attr'
			signal: string
			query: string
			attr: string
			parser: ParserKind | AuthoredParser
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
			/**
			 * The parser the value read goes through (LT-443): the
			 * `harvest()` marker's, spliced as authored — it owns the
			 * no-match miss, so `default` is unused then. Absent (today's
			 * raw read) for an unmarked seed.
			 */
			parser?: AuthoredParser
	  }
	| {
			/**
			 * Arg-substituted seed (LT-008): the initializer reads server args
			 * (e.g. `createCell(value.length)`); the client seeds from the
			 * args' rendered DOM sites — the param identifier is replaced by
			 * an element-derived read (DOM-is-truth, ADR 0024 sub-design 3).
			 */
			kind: 'substitute'
			signal: string
			/** Initializer text with param identifiers replaced by DOM reads. */
			expr: string
			/**
			 * The parser the substituted DOM read goes through (LT-443): the
			 * `harvest()` marker's, spliced as authored. Absent for an
			 * unmarked seed — a `number` arg's read carries its own `Number()`
			 * conversion (`asParamType`), everything else is a string.
			 */
			parser?: ParserKind | AuthoredParser
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
			seed:
				| 'verbatim'
				| { container: string; valueSelector: string }
				| { container: string; fields: ListFieldPlan[] }
	  }

/**
 * How one field of an arg-seeded list's item is read back from the adopted
 * item (ADR 0046 s7, LT-429): its site — `data-key` for the field the
 * `keyConfig` returns verbatim, else the first text child or reactive
 * attribute reading exactly the field — and its parser. A `selector` is the
 * item's own scoped query; null reads the item root.
 */
export type ListFieldPlan = {
	field: string
	site:
		| { kind: 'key' }
		| { kind: 'text'; selector: string | null }
		| {
				kind: 'attr'
				selector: string | null
				attr: string
				/** A dirty-flag attribute (`value`/`checked`/`selected`) reads the live property. */
				property: boolean
				/** The site element's tag, for the property read's type. */
				tag: string
		  }
	parser:
		| { kind: 'inferred'; name: ParserKind; cast: string | null }
		| {
				kind: 'authored'
				/** The `harvest()` entry's parser, as authored. */
				text: string
				start: number
				/** Whether the call needs parentheses around `text` (an arrow, an operator). */
				wrap: boolean
				/** The entry's key, and where it starts — a type error maps there. */
				keyText: string
				keyStart: number
		  }
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
			/**
			 * Property vs attribute dispatch (LT-116): a bare host-prop mirror
			 * OR a dirty-flag IDL attr (`value`/`checked`/`selected`) on a
			 * native form control lowers to `bindProperty` — attribute
			 * rewriting stops moving the live property once the control is
			 * dirty, which broke form-radiogroup's mutual exclusion (NOTES
			 * LT-092). Same rule the top-level `watch-attr` dispatch applies.
			 */
			dispatch: 'attribute' | 'property'
			/** Number-valued thunks stringify — `bindAttribute` takes string|boolean. */
			coerceToString: boolean
			/** Source range of `thunkText` (LT-011 span table). */
			sourceStart: number | undefined
			sourceEnd: number | undefined
			/**
			 * Scoped selector (resolved within the loop output's own subtree,
			 * LT-037) of the descendant this construct lives on, or `null` for
			 * the output root itself. Non-null targets are queried once per
			 * item (`itemParam.querySelector(target)`) and cached under a
			 * generated local, so multiple constructs on the same descendant
			 * share one query.
			 */
			target: string | null
	  }
	| {
			kind: 'watch-class'
			keys: string[]
			thunkText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
			target: string | null
	  }
	| {
			kind: 'on'
			event: string
			handlerText: string
			sourceStart: number | undefined
			sourceEnd: number | undefined
			target: string | null
	  }

/** One `@for` over server data lowered to `each()`. */
export type ForClientPlan = {
	/** Collection query variable (`tabs`); empty for a scoped loop. */
	collection: string
	/**
	 * A loop nested in a Mount Scope (ADR 0046 s2, LT-424): its items are
	 * fixed for the life of the clone, so the collection is a static query
	 * against the scope root — `root`, the root's local — with no `all()`
	 * and no MutationObserver. Null for a host-level loop (`each(all())`).
	 */
	scoped: { root: string; selector: string } | null
	/** Element parameter name inside each() (`tab`). */
	itemParam: string
	rebindings: RebindingPlan[]
	effects: LoopEffectPlan[]
}

/**
 * One reactive-list item as a Mount Scope (ADR 0046 s1): the per-item mount
 * `bindItem` runs, addressed through the item's own `first` — the item root
 * by its element parameter (declared as a typed local only when something
 * binds it), descendants by scoped queries.
 */
export type ReconcileItemScope = {
	/** The item root's local (the bound element, typed by its tag). */
	root: { name: string; tag: string } | null
	/** Descendants the item's effects address, queried within the item root. */
	locals: ScopeLocal[]
	/**
	 * Key-derived attributes (ADR 0046 s1): `server` attributes over the key
	 * binding, set once at clone — a key never changes, so there is nothing
	 * to watch. `el` names the root local or a scope local.
	 */
	keyAttrs: KeyAttrPlan[]
	/** The item's effects, in document order. */
	effects: TopEffectPlan[]
	/**
	 * The item's setup statements (ADR 0046 s5), in source order: mounted
	 * in `bindItem` before its key-derived attributes and effects, which
	 * may read them.
	 */
	setup: readonly ItemSetupStmt[]
}

/** One reactive `@for` over a declared List lowered to `reconcile()`. */
export type ReconcilePlan = {
	/** Component tag (query messages). */
	tag: string
	/** Container query variable (`container`). */
	container: string
	/**
	 * The list's compile-time document-order index per component (ADR 0046
	 * s2): the extracted template is stamped `data-list` and hoisted to the
	 * host's end, one copy per instance, and queried from the host as
	 * `:scope > template[data-list="N"]` — the stamp lifts the
	 * one-list-per-component limit, and the hoist lets a container be any
	 * element, a Mount Scope root included.
	 */
	listIndex: number
	/** The declared createList signal (`items`). */
	signal: string
	/** bindItem's item-signal parameter, named after the loop variable. */
	itemParam: string
	/** bindItem's key parameter, from `key k` (null → `_key`). */
	keyParam: string | null
	/**
	 * Scoped selector of the FIRST bare `{item}` hole's parent element — the
	 * item value's DOM site the arg-seeded List harvest reads at connect
	 * (ADR 0003). Null when the body renders the item nowhere; an arg-seeded
	 * List without a hole is refused in the harvest pass, a literal-seeded
	 * one needs no site.
	 */
	holeSelector: string | null
	/** The item's Mount Scope: everything bindItem mounts per entering item. */
	itemScope: ReconcileItemScope
	/**
	 * Query variables of the `@empty` arm's roots (LT-212), in order. Each
	 * root is always server-rendered inside the container with
	 * `data-unreconciled`; the client toggles its `hidden` from the list's
	 * length (ADR 0037 s5: the toggle path). Empty when the loop has no arm.
	 */
	emptyQueries: string[]
	/**
	 * The list sits in a Mount Scope (an arm, an item; LT-424): `container`,
	 * `parent` and `emptyQueries` name that scope's locals, filled in pass 4
	 * — and an arg-seeded harvest has no connect-time container to read.
	 */
	scoped: boolean
}

/**
 * One element a Mount Scope's mount queries through its `first`. `optional`
 * marks an element reached through a server-rendered conditional branch
 * that carries only key-derived attributes (LT-424): the render's winner may
 * not include it, so the query does not throw (`first(selector)`).
 */
export type ScopeLocal = {
	name: string
	selector: string
	message: string
	optional?: boolean
}

/**
 * A key-derived attribute (ADR 0046 s1): a `server` attribute over the
 * enclosing items' key bindings alone, set once at mount — a key never
 * changes, so there is nothing to watch. `el` names the scope root local or
 * a scope local.
 */
export type KeyAttrPlan = {
	el: string
	/** `el` is an optional local (LT-424): the write is `el?.setAttribute`. */
	optional?: boolean
	attr: string
	exprText: string
	sourceStart: number | undefined
	sourceEnd: number | undefined
}

/** One arm of a reactive conditional, mounted inside `bindArm`. */
export type ArmPlan = {
	/** The arm key (ADR 0037 s2): `then`/`else`, `case:<value>`, `default`. */
	key: string
	/** A `@case` test's source text, null for `then`/`else`/`default`. */
	caseText: string | null
	/** False for an arm that renders nothing: no template, no mount. */
	renders: boolean
	/** The arm root's local (the bound element, typed by its tag). */
	root: { name: string; tag: string } | null
	/** Descendants the arm's effects address, queried within the arm root. */
	locals: ScopeLocal[]
	/** Key-derived attributes of an arm nested in a list item (LT-424). */
	keyAttrs: KeyAttrPlan[]
	effects: TopEffectPlan[]
}

/**
 * A reactive conditional or an async boundary (ADR 0037) lowered to
 * `reconcile()`'s arm form: the arm templates the server stamped
 * `data-arms="<armSet>"` beside the live winner, a key thunk over the test
 * (or the boundary's task state), and one mount per arm.
 */
export type ArmsPlan = {
	/** Container query variable, or `'host'` at the component root. */
	container: string
	/** The arm set's index in document order (`data-arms`). */
	armSet: number
	construct: 'if' | 'switch' | 'try'
	/** The `@if` test or `@switch` discriminant verbatim; the boundary's signal. */
	testText: string
	sourceStart: number | undefined
	/** `bindArm`'s parameter names. */
	elementParam: string
	keyParam: string
	arms: ArmPlan[]
	/**
	 * An async boundary's routing (ADR 0037 s4): the arm key follows the
	 * guarded task's state (`ok`/`nil`/`err`, `match()`'s precedence), the
	 * `ok` arm's mount writes the resolved value as its root's text and the
	 * `err` arm's mount writes `errText` — the err arm's own lazy child over
	 * `error` (bare or a member read), null when it has none.
	 */
	boundary?: {
		signal: string
		errText: string | null
		/** Offsets of the `ok` and `err` arms' lazy children (LT-428 spans). */
		okStart: number | undefined
		errStart: number | undefined
	}
}

export type TopEffectPlan =
	| {
			kind: 'watch-text'
			query: string
			source: string
			/**
			 * The authored child's text and offset (LT-011 span table): the
			 * `bindText` sink is typed, so a non-text source is a tsc error
			 * `check:corpus` reports at the child (LT-428).
			 */
			exprText: string
			sourceStart: number | undefined
	  }
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
			 * `truc:html={() => …}` (LT-025): one `watch(thunk,
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
	| { kind: 'arms'; arms: ArmsPlan }
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
	/**
	 * Why this component cannot be answered by phase 1 alone (ADR 0029,
	 * LT-165) — the tier classifier's input, collected at the same sites
	 * that used to raise `LTC004`/`LTC034`. Empty means phase 1 is total,
	 * which is the Folded tier.
	 */
	routingSignals: LocalRoutingSignal[]
	/**
	 * Reactive sites whose expression no server phase can answer (ADR 0029
	 * sub-design 1 limb b, LT-165 step 7) — recorded at the same sites for
	 * the driver's serialization-time suppression: the generated client
	 * still binds them, and the realm replays that module.
	 */
	suppressedSites: SuppressedSite[]
	/**
	 * The message keys client positions read through `t.<key>` (ADR 0030 s9,
	 * LT-218), sorted. Non-empty means the server renders the root `i18n`
	 * attribute and the generated factory carries the message preamble.
	 */
	clientMessageKeys: string[]
}

/**
 * The order-carrying environment every analysis pass shares (ADR 0040 s5,
 * LT-289) — the accumulators whose APPEND ORDER is the contract: queries,
 * used names, ambient context, child tags, ref names, and the diagnostic /
 * routing / suppression sinks, all appended in pass order so query and
 * diagnostic sequences are byte-stable. A pass's own PRODUCTIONS are not
 * here: they are return values the next pass takes as a required parameter
 * (`runLoops(shared) → LoopPlans`, `runHarvest(shared, loopPlans) →
 * HarvestPlans`, `runEffects(shared, loopPlans, harvests) → EffectPlans`),
 * so running a pass before its producer is a type error rather than a read
 * of an empty map. Construct one via `analyzeClient`, or by hand in tests.
 */
export type PassShared = {
	component: ComponentIR
	source: string
	diagnostics: LocalDiagnostic[]
	/** Tier routing signals (ADR 0029) — see {@link ClientPlan.routingSignals}. */
	routingSignals: LocalRoutingSignal[]
	/**
	 * Suppression sites (ADR 0029 s1 limb b, LT-165 step 7) — see
	 * {@link ClientPlan.suppressedSites}.
	 */
	suppressedSites: SuppressedSite[]
	registry: ReadonlySet<string>
	/**
	 * The compose-reference resolution (LT-127): `skipped` in the
	 * registry-discovery pass, else `resolved` — carrying the composed
	 * (PascalCase) elements' targets keyed by resolved source path (ADR 0024
	 * sub-design 10), and the compose sites an ambiguous `first()` matched,
	 * already reported as LTC027, so `emitComposeEffects` must not address
	 * them by tag or report them a second time.
	 */
	composeRefs: ComposeRefs
	/** The generated factory's element queries, in registration order. */
	queries: QueryPlan[]
	/** Registry-child tags addressed (type-flow imports). */
	childTags: Set<string>
	/** Context members the factory must destructure. */
	ambient: Set<string>
	/** Claimed variable names (queries, rebindings; never signals/refs). */
	usedNames: Set<string>
	/** Every ref name in the template, pre-collected. */
	refNames: Set<string>
	/**
	 * Signals Pass 3 refused with their own harvest diagnostic — a
	 * formatted-only render with no raw value source (LTC059, LT-374), a
	 * list item field with no site or no parser (LTC072/LTC076, LT-429) —
	 * so the setup half's LTC005 skips them.
	 */
	rawSourceRefused: Set<string>
	/** Register (or reuse) a query; returns its variable name. */
	addQuery: (
		base: string,
		selector: string,
		cardinality: 'one' | 'many' | 'maybe',
	) => string
	/** Note context members (`host`, `internals`) a client code position reads. */
	collectAmbient: (node: AstNode | null | undefined) => void
	/** Free names in a reactive/pass thunk the client cannot resolve. */
	badFreeNames: (node: AstNode) => string[]
	/**
	 * Free names in a list-body position the client cannot resolve:
	 * `badFreeNames` plus setup consts and authored imports, which no
	 * client-need walk reaches there.
	 */
	badListBodyNames: (node: AstNode) => string[]
}

/** `runLoops`'s production: every `@for`'s client plan, by loop kind. */
export type LoopPlans = {
	/** Server-data `@for` → `each()` plans. */
	forPlans: ReadonlyMap<EachForIR, ForClientPlan>
	/** Reactive-list `@for` → `reconcile()` plans. */
	reconcilePlans: ReadonlyMap<ReconcileForIR, ReconcilePlan>
}

/** `runHarvest`'s production: the signals' seeding plans, in signal order. */
export type HarvestPlans = readonly HarvestPlan[]

/** `runEffects`'s production: the document-ordered client effect list. */
export type EffectPlans = TopEffectPlan[]

/* === Exported Functions === */

export const analyzeClient = (
	component: ComponentIR,
	registry: ReadonlySet<string>,
	diagnostics: LocalDiagnostic[],
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): ClientPlan => {
	const source = component.source
	const queries: QueryPlan[] = []
	const childTags = new Set<string>()
	const ambient = new Set<string>(component.contextRefs)
	// A context member read only from a setup declaration the client module
	// emits (`host` inside a `createTask` callback, LT-104; `all()` in a
	// plain const's initializer, LT-108) reaches no effect position
	// `collectAmbient` walks, so it is collected here from the client
	// module's own needed names.
	for (const name of computeClientNeededNames(component))
		if (CONTEXT_NAMES.has(name) || CLIENT_ONLY_PRIMITIVES.has(name))
			ambient.add(name)
	const collectAmbient = (node: AstNode | null | undefined): void => {
		if (!node) return
		for (const name of freeIdentifiers(node))
			if (CONTEXT_NAMES.has(name)) ambient.add(name)
	}
	const usedNames = new Set<string>([
		component.tag.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
		...component.signals.map(s => s.name),
		'host',
		// An item's setup names bind in `bindItem` (ADR 0046 s5): a minted
		// local there must not shadow one.
		...component.itemSetup.flatMap(stmt =>
			stmt.name === null ? [] : [stmt.name],
		),
	])
	// LT-127: `first()` selectors addressing COMPOSED children are resolved
	// here, not in `compileSource` — the child's tag needs the registry.
	// Runs before the `refNames` walk below, which is what finds the
	// synthetic `{kind: 'ref'}` attrs this attaches.
	const composeRefs = resolveComposeRefs(
		component,
		diagnostics,
		composeRegistry,
	)
	// LT-096: what each composed child renders, so every selector resolved
	// below is unique over the DOM the query actually searches — the
	// children's markup included — not just over this template.
	if (composeRefs.mode === 'resolved')
		component.composedShapes = composedShapesFor(
			component.root,
			composeRefs.registry,
		)

	// Pre-collect ref names — thunks may reference any ref in the template.
	// Traversal via `walkTemplate` (LT-042): refs are declared on plain and
	// composed elements only, and composition is a boundary.
	const refNames = new Set<string>()
	walkTemplate(
		component.root,
		node => {
			if (node.kind !== 'element' && node.kind !== 'compose') return
			for (const attr of node.attrs)
				if (attr.kind === 'ref') refNames.add(attr.name)
		},
		{ intoCompose: false },
	)

	// A deferred compose reference (LT-127) is an author-declared element
	// reference whether or not this pass can resolve it: the registry-
	// discovery pass has no `composeRegistry` and attaches no `ref` attr for
	// the walk above to find, and a pass thunk reading the name there must
	// not be rejected as server-only (LTC005) for a name that resolves in
	// pass 2.
	for (const ref of component.firstRefs.values())
		if (ref.stage === 'deferred') refNames.add(ref.name)

	// Optional refs matching nothing structural (LT-123): the
	// template never carried a `ref` attr for them, so the walk
	// above found nothing — but the author declared the const
	// and setup code may read it. Query them from the AUTHORED
	// selector under `maybe` cardinality (non-throwing `first()`),
	// under the authored NAME, which is what setup references.
	for (const ref of [
		...[...component.firstRefs.values()].filter(
			ref => ref.stage === 'unmatched',
		),
		...(composeRefs.mode === 'resolved' ? composeRefs.unmatchedOptional : []),
	]) {
		refNames.add(ref.name)
		usedNames.add(ref.name)
		queries.push({
			name: ref.name,
			selector: ref.selector,
			cardinality: 'maybe',
			message: '',
		})
	}

	/**
	 * Names the server render binds and the client module does not carry
	 * (LT-348): the component's parameters (nested `{ i18n: { t } }`
	 * included), module-level declarations (neither generated module copies
	 * them), and the bindings of a server-data loop (item, index, hoisted
	 * consts — `each()` rebinds none of them client-side). Defined
	 * positively: an unknown name that is none of these (`clearTimeout`, a
	 * typo) is not a server name, and tsc on the generated module reports
	 * it with the right message.
	 */
	const serverBindings = new Set<string>([
		...renderOnlyBindings(component),
		...(component.moduleBindings ?? []),
	])

	// Client rebindings shadow a server binding of the same name — only the
	// ones the AUTHOR declared: signals, `first()` refs, context members,
	// plain setup consts (LT-088: a const pulled client-side is emitted
	// there, and one that itself reads a server name is caught at its
	// declaration, the setup half below) and authored imports (LT-091).
	// Compiler-generated query locals are not (LT-349): args `{ button }`
	// beside a queried `<button>` would otherwise compile a handler reading
	// `button` against the element, silently changing its meaning. LT-136
	// keeps the naming side of that shadow.
	const setupNames = new Set(
		component.setup.map(s => s.name).filter((n): n is string => !!n),
	)
	/** Factory-scope bindings every client position sees. */
	const factoryBinds = (name: string): boolean =>
		component.signals.some(s => s.name === name) ||
		refNames.has(name) ||
		CONTEXT_NAMES.has(name)
	/** Bindings the client module emits only where a client-need walk reaches. */
	const emittedOnDemand = (name: string): boolean =>
		setupNames.has(name) ||
		component.imports.clientLeTrucNames.has(name) ||
		component.imports.plainLocalNames.has(name)
	const clientRebinds = (name: string): boolean =>
		factoryBinds(name) || emittedOnDemand(name)

	// The client message channel (ADR 0030 s9, LT-218): `t` is a server
	// binding, but a static read of a declared key (`t.hi`, `t['a.b']`)
	// compiles against the preamble's local `t`. The key is recorded, so
	// the server serializes exactly those messages into the root `i18n`
	// attribute. A computed key, a bare `t` or an undeclared key keeps `t`
	// server-only.
	const tNames = new Set(component.messageTBindings ?? [])
	const declaredKeys = component.i18nMessages ?? {}
	const clientMessageKeys = new Set<string>()
	/** Free names in a client-emitted position that only the server binds. */
	const badFreeNames = (node: AstNode): string[] =>
		[...dependenciesOf(node)].filter(name => {
			if (!serverBindings.has(name) || clientRebinds(name)) return false
			if (!tNames.has(name)) return true
			const keys = staticMessageReads(node, name, declaredKeys)
			if (keys === null) return true
			for (const key of keys) clientMessageKeys.add(key)
			return false
		})

	/**
	 * `badFreeNames` for a list body (`each()`/`reconcile()` scopes, LT-349),
	 * plus the setup consts and authored imports the body reads. Those are
	 * client bindings, but `computeClientNeededNames` walks no list-body
	 * position, so a const or import read only there is never emitted
	 * client-side — admitting it would compile a ReferenceError.
	 */
	const badListBodyNames = (node: AstNode): string[] => {
		const bad = new Set(badFreeNames(node))
		return [...dependenciesOf(node)].filter(
			name => bad.has(name) || (!factoryBinds(name) && emittedOnDemand(name)),
		)
	}

	// Client-only setup statements admitted for their `t.<key>` reads
	// (`setup-extraction.ts`'s gate, LT-349) carry their keys into the
	// attribute; the preamble precedes those statements.
	for (const stmt of [
		...component.clientSetup,
		...component.itemSetup.filter(stmt => stmt.kind !== 'ref'),
	])
		for (const name of dependenciesOf(stmt.node)) {
			if (!tNames.has(name)) continue
			for (const key of staticMessageReads(stmt.node, name, declaredKeys) ?? [])
				clientMessageKeys.add(key)
		}

	const routingSignals: LocalRoutingSignal[] = []
	const suppressedSites: SuppressedSite[] = []
	const shared: PassShared = {
		component,
		source,
		diagnostics,
		routingSignals,
		suppressedSites,
		registry,
		composeRefs,
		queries,
		childTags,
		ambient,
		usedNames,
		refNames,
		rawSourceRefused: new Set(),
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
		badListBodyNames,
	}

	// The pass order is carried by the signatures (ADR 0040 s5): each pass
	// takes its producers' output as a required parameter.
	const loopPlans = runLoops(shared)
	const harvests = runHarvest(shared, loopPlans)
	const effects = runEffects(shared, loopPlans, harvests)

	// LT-347: the setup half of the server-only check. `expose()` and every
	// plain const a client position pulls in are emitted into the client
	// verbatim, so a server arg they read is unbound there — the same
	// ReferenceError a reactive thunk would hit, caught here rather than
	// left to tsc on the generated module.
	for (const prop of asArray(component.expose?.argNode?.properties))
		if (prop.type === 'Property' && isNode(prop.value))
			reportServerOnlyNames(
				shared,
				prop.value,
				`\`expose()\` entry \`${identifierName(prop.key) ?? '…'}\``,
			)
	// A signal with no harvest site (or a verbatim-seeded list) keeps its
	// authored initializer client-side (`emit-client.ts`). Tier-independent
	// (Architect ruling, LT-348): a `realm` resolution means the server can
	// render the value, not that the browser can run the initializer. The
	// setup entry holds the whole constructor call, options included.
	for (const signal of component.signals) {
		if (signal.family === 'context') continue
		if (shared.rawSourceRefused.has(signal.name)) continue
		const harvest = harvests.find(h => h.signal === signal.name)
		if (harvest && !(harvest.kind === 'list' && harvest.seed === 'verbatim'))
			continue
		const call = component.setup.find(s => s.name === signal.name)?.node
		if (call)
			reportServerOnlyNames(
				shared,
				call,
				`The initializer of signal \`${signal.name}\``,
			)
	}
	const clientNeeded = computeClientNeededNames(component)
	for (const stmt of component.plainSetup)
		if (stmt.name && clientNeeded.has(stmt.name))
			reportServerOnlyNames(
				shared,
				stmt.node,
				`Setup const \`${stmt.name}\`, which a client position reads,`,
			)

	// LT-165 step 5: the narrow residue of the retired LTC013/LTC043
	// refusals. An UNrendered setup const the value harness cannot evaluate
	// is a routing signal (recorded during extraction) and routes Simulated —
	// but a const whose VALUE reaches a server-evaluated position asks the
	// server to splice a value no phase can produce: the fold cannot run the
	// read, the realm would have to serialize the site, and the Static tier
	// omits it with no client binding to correct it. Same structural class as
	// `impureStaticChild` — a permanent wrong-or-empty site — so it stays an
	// error even under tiering.
	const serverUsed = serverUsageNames(component)
	const harnessUnevaluableNames = new Set([
		...CLIENT_ONLY_PRIMITIVES,
		...refNames,
		...CONTEXT_NAMES,
	])
	for (const stmt of component.plainSetup) {
		if (stmt.name === null) continue
		if (!/Function(Expression)?$/.test(String(stmt.node.type))) {
			const badNames = [...freeIdentifiers(stmt.node)]
				.filter(name => harnessUnevaluableNames.has(name))
				.sort()
			if (badNames.length > 0 && serverUsed.has(stmt.name))
				diagnostics.push(
					diagnostic.renderedClientOnlyConst(
						source,
						stmt.range,
						stmt.name,
						badNames,
					),
				)
		}
	}

	// LT-123: an effect over an author-declared OPTIONAL ref
	// needs the same existence guard a single-branch `@if` root
	// gets — the query is non-throwing, so the local is
	// `Element | undefined` and binding it bare neither
	// typechecks nor runs. `handleOptionalBranch` already
	// wraps the STRUCTURALLY optional case; this covers the
	// case where the template renders the element
	// unconditionally but the author declared the reference
	// optional anyway (`basic-button`'s `span.label`, which a
	// page may simply not have authored).
	const maybeQueryNames = new Set(
		queries.filter(q => q.cardinality === 'maybe').map(q => q.name),
	)
	const guardedEffects: TopEffectPlan[] = []
	for (const effect of effects) {
		const target =
			effect.kind !== 'guarded' && 'query' in effect ? effect.query : null
		if (target === null || !maybeQueryNames.has(target)) {
			guardedEffects.push(effect)
			continue
		}
		// Consecutive effects over the same optional element
		// share one guard, exactly as a branch's own do.
		const last = guardedEffects.at(-1)
		if (last?.kind === 'guarded' && last.query === target)
			last.effects.push(effect)
		else
			guardedEffects.push({
				kind: 'guarded',
				query: target,
				effects: [effect],
			})
	}

	// The preamble reads the `i18n` attribute off the host.
	if (clientMessageKeys.size > 0) ambient.add('host')

	return {
		queries,
		harvests: [...harvests],
		effects: guardedEffects,
		clientMessageKeys: [...clientMessageKeys].sort(),
		ambientContext: [...ambient].sort(),
		childTags: [...childTags].sort(),
		routingSignals,
		suppressedSites,
	}
}
