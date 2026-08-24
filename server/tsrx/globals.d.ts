/**
 * Ambient identifiers for raw `.tsrx` sources (ADR 0023 sub-design 6, LT-004).
 *
 * A `.tsrx` source imports nothing — the compiler recognizes the ambient
 * vocabulary (signal constructors, `expose`, the context names `host` and
 * `internals`, the `as*` parser factories, `defineMethod`) and materializes
 * real imports in the generated client. This file provides the same
 * vocabulary as TypeScript ambient declarations so `.tsrx`-shaped code
 * type-checks in editor surfaces that consume it (the raw-source caveat:
 * `@{ }` blocks and `@for`/`@if` directives are not TS syntax — the Volar
 * projection over the generated client is the authoritative view; these
 * globals are the fallback that keeps the identifier set honest).
 *
 * The coverage test (`server/tests/tsrx/globals.test.ts`) pins this file
 * against the compiler's recognized sets — extending the vocabulary in the
 * compiler without extending this file fails CI.
 */

type LeTruc = typeof import('@zeix/le-truc')

/** Signal constructors (compiler.ts SIGNAL_CTORS). */
declare const createCell: LeTruc['createCell']
declare const createState: LeTruc['createState']
declare const createList: LeTruc['createList']
declare const createStore: LeTruc['createStore']
declare const deriveCell: LeTruc['deriveCell']
declare const deriveList: LeTruc['deriveList']
declare const deriveStore: LeTruc['deriveStore']

/**
 * Context names usable as free names in every client code position
 * (compiler.ts CONTEXT_NAMES). The factory context owns the precise types;
 * these are the permissive ambient stand-ins for the raw-source view.
 */
declare const host: HTMLElement & Record<string, unknown>
declare const internals: ElementInternals | null
declare const expose: (
	props: import('@zeix/le-truc').Initializers<Record<string, unknown>>,
) => void

/**
 * Web Components Community Protocol helpers (LT-035, ADR 0024 sub-design 15)
 * — `FactoryContext` members, never module imports. `requestContext` is
 * signal-SHAPED downstream (`.get()`) but has no server behavior at all; see
 * `compiler.ts`'s `SignalIR.fallbackText` for the server-side substitution.
 */
declare const requestContext: import('@zeix/le-truc').FactoryContext<
	Record<string, unknown>
>['requestContext']
declare const provideContexts: import('@zeix/le-truc').FactoryContext<
	Record<string, unknown>
>['provideContexts']

/** Parser factories recognized in expose() initializers (PARSER_FACTORIES). */
declare const asString: LeTruc['asString']
declare const asInteger: LeTruc['asInteger']
declare const asNumber: LeTruc['asNumber']
declare const asBoolean: LeTruc['asBoolean']
declare const asEnum: LeTruc['asEnum']
declare const asClampedInteger: LeTruc['asClampedInteger']
declare const asJSON: LeTruc['asJSON']

/** Method-producer brand for expose() members. */
declare const defineMethod: LeTruc['defineMethod']

/**
 * The form-associated host type, referenced without import in a source's
 * `declare global` HTMLElementTagNameMap augmentation when
 * `config.formAssociated` leads the extensions.
 */
type FormAssociatedElement = import('@zeix/le-truc').FormAssociatedElement
