/**
 * The front end's mutable extraction state (LT-244): one `ExtractContext`
 * per compiled source, threaded through `runFrontEnd`, setup extraction,
 * template lowering, attribute classification and the validation tail.
 * It lives here, beside its consumers, rather than in `ir.ts` — it carries
 * function members and accumulates diagnostics, so it is front-end state,
 * not IR. `ir.ts` stays a pure-data leaf.
 */

import type { AstNode } from './ast-node'
import type { LocalDiagnostic } from './diagnostics'
import type { MarkerName } from './imports'
import type { Surface } from './surface'
import type { LocalRoutingSignal } from './tier'

/* === Types === */

/** Shared lowering/classification context for one source on one surface. */
export type ExtractContext = {
	source: string
	/** The authored surface — selects the diagnostic vocabulary (LT-233). */
	surface: Surface
	diagnostics: LocalDiagnostic[]
	/**
	 * Why this component cannot be answered by phase 1 alone (ADR 0029,
	 * LT-165). Collected at the same setup-extraction sites that raise
	 * `LTC013`/`LTC043`, and merged in `index.ts` with the analysis pass's
	 * own signals before the tier is classified.
	 */
	routingSignals: LocalRoutingSignal[]
	/**
	 * Prop names `expose()` declares, plus the managed form props. Populated
	 * before template lowering so a string-literal child naming a prop can be
	 * diagnosed (LTC019) — that spelling meant "watch this prop by name"
	 * only while the `&` sigil disambiguated it from ordinary text.
	 */
	exposedProps: Set<string>
	/** Names server-known at template evaluation time (args, setup). */
	serverKnown: Set<string>
	/**
	 * Prop names exposed through a Parser factory — the subset of
	 * `exposedProps` seeded from the HOST ATTRIBUTE rather than
	 * from the component's own markup. LT-122 excludes them; see
	 * `bindsExposedArg`.
	 */
	parserProps: Set<string>
	/** The Parser factory name backing a `parserProps` entry (LTC039). */
	parserFactoryOf: (prop: string) => string
	/**
	 * The `first()`-bound ref names a Parser-exposed prop's FALLBACK
	 * expression reads (LT-129). `asNumber(asNumber(1)(input.step))` returns
	 * `{'input'}` — the fallback re-reads the very element the arg renders
	 * into, which is the data account's sanctioned OVERRIDE precedence rather
	 * than a second copy, so LTC039 must not fire on it.
	 */
	parserFallbackRefsOf: (prop: string) => ReadonlySet<string>
	/**
	 * The component function's own parameter names — the strict
	 * subset of `serverKnown` that arrives from the CALLER. LT-122's
	 * arg-and-prop coincidence is about those only: a setup const or
	 * signal sharing a prop's name is a different relationship.
	 */
	argNames: Set<string>
	/**
	 * Local name → import specifier resolved to a repo-relative `.tsrx` path,
	 * for composed (PascalCase) elements (ADR 0024 sub-design 10).
	 */
	composeImports: ReadonlyMap<string, string>
	/**
	 * Local name → the compile-time marker it binds (ADR 0034 s1, LT-442):
	 * imports from `@zeix/le-truc-compiler/macros`, less the names a
	 * component-scope declaration shadows. Read through `markerOf`.
	 */
	markers: ReadonlyMap<string, MarkerName>
	/**
	 * Setup-level `const name = init` initializers, by name — lets an event
	 * attribute reference a hoisted handler by identifier (`{onInput}`)
	 * instead of only accepting an inline function expression; the resolved
	 * initializer is treated exactly like an inline one (same handler text,
	 * so `@if` branches that share the identifier automatically agree).
	 */
	setupInits: ReadonlyMap<string, AstNode>
	/**
	 * Loop item/index/key bindings of the loops being lowered (innermost last).
	 * They shadow same-named signals inside the loop body (LT-387).
	 */
	loopBound: string[]
	/**
	 * Parallel to `loopBound`: whether each binding is a reactive-list item or
	 * key (ADR 0046 s3) — a signal, so a condition over it is reactive and
	 * switches arms inside the item's mount (LT-424).
	 */
	loopReactive: boolean[]
	/**
	 * What a reactive-list item's setup (ADR 0046 s5) resolves against
	 * beyond its own names: the authored imports, the component's `first()`
	 * refs, and the client message channel's `t` bindings and declared keys.
	 * Seeded with the rest of the context after setup extraction.
	 */
	setupScope: {
		importedNames: ReadonlySet<string>
		refNames: ReadonlySet<string>
		tNames: ReadonlySet<string>
		declaredKeys: Readonly<Record<string, string>>
	}
}

/* === Internal Functions === */

/** Shared empty result for the `parserFallbackRefsOf` context hook. */
const EMPTY_NAMES: ReadonlySet<string> = new Set<string>()

/* === Exported Functions === */

/** A fresh extraction context for one source on one surface. */
export const createExtractContext = (
	source: string,
	surface: Surface,
): ExtractContext => ({
	source,
	surface,
	diagnostics: [],
	routingSignals: [],
	exposedProps: new Set<string>(),
	serverKnown: new Set<string>(),
	argNames: new Set<string>(),
	parserProps: new Set<string>(),
	parserFactoryOf: () => '',
	parserFallbackRefsOf: () => EMPTY_NAMES,
	composeImports: new Map<string, string>(),
	markers: new Map<string, MarkerName>(),
	setupInits: new Map<string, AstNode>(),
	loopBound: [],
	loopReactive: [],
	setupScope: {
		importedNames: EMPTY_NAMES,
		refNames: EMPTY_NAMES,
		tNames: EMPTY_NAMES,
		declaredKeys: {},
	},
})
