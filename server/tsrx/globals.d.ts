/**
 * Ambient identifiers for raw `.tsrx` sources (ADR 0023 sub-design 6;
 * import policy per ADR 0024 sub-design 16).
 *
 * A `.tsrx` source imports the REAL package exports its setup code uses
 * (`import { createCell } from '@zeix/le-truc'`) — signal constructors,
 * parsers, `defineMethod`, form utilities are true module exports and stay
 * valid TypeScript by construction. The FactoryContext vocabulary below is
 * the exception: the factory parameter these names arrive on is
 * compiler-generated, so there is no authored binding site an import or
 * destructure could honestly occupy — they stay ambient. This file declares
 * exactly that ambient vocabulary (`FACTORY_CONTEXT_MEMBERS` ∪
 * `CONTEXT_NAMES`, `ast-utils.ts`) so `.tsrx`-shaped code type-checks in
 * editor surfaces that consume it (the raw-source caveat: `@{ }` blocks and
 * `@for`/`@if` directives are not TS syntax — the Volar projection over
 * the generated client is the authoritative view; these globals are the
 * fallback that keeps the identifier set honest).
 *
 * The coverage test (`server/tests/tsrx/globals.test.ts`) pins this file
 * against the compiler's recognized sets — extending the vocabulary in
 * the compiler without extending this file fails CI.
 */

type LeTrucFactoryContext = import('@zeix/le-truc').FactoryContext<
	Record<string, unknown>
>

/** Effect helpers received via the compiler-generated factory parameter. */
declare const all: LeTrucFactoryContext['all']
declare const first: LeTrucFactoryContext['first']
declare const on: LeTrucFactoryContext['on']
declare const pass: LeTrucFactoryContext['pass']
declare const watch: LeTrucFactoryContext['watch']
declare const expose: LeTrucFactoryContext['expose']

/**
 * Context names usable as free names in every client code position
 * (compiler.ts CONTEXT_NAMES). The factory context owns the precise types;
 * `host`/`internals` keep their permissive ambient stand-ins for the
 * raw-source view.
 */
declare const host: HTMLElement & Record<string, unknown>
declare const internals: ElementInternals | null

/**
 * Web Components Community Protocol helpers (LT-035, ADR 0024 sub-design 15)
 * — `FactoryContext` members, never module imports. `requestContext` is
 * signal-SHAPED downstream (`.get()`) but has no server behavior at all; see
 * `compiler.ts`'s `SignalIR.fallbackText` for the server-side substitution.
 */
declare const requestContext: LeTrucFactoryContext['requestContext']
declare const provideContexts: LeTrucFactoryContext['provideContexts']

/**
 * The form-associated host type, referenced without import in a source's
 * `declare global` HTMLElementTagNameMap augmentation when
 * `config.formAssociated` leads the extensions.
 */
type FormAssociatedElement = import('@zeix/le-truc').FormAssociatedElement

/**
 * The reserved `i18n` parameter's record (ADR 0030 sub-design 2, LT-173).
 * Ambient in raw `.tsrx` sources — the compiler supplies the value at
 * every render call boundary and the generated server modules import the
 * concrete declaration from the generated `i18n` module — so a component
 * annotating `{ …, i18n: I18n }` type-checks without an authored import
 * (the library gains no i18n surface: ADR 0030 sub-design 8).
 *
 * `t` is the component's own resolved messages (`export const i18n`'s
 * keys); `lang` is the effective BCP 47 tag after precedence; `timeZone`/
 * `currency` are the formatting configuration for `Intl` consumers;
 * `dir` is the text direction derived from `lang` (never rendered per
 * component — direction belongs on the page's `<html>`).
 */
interface I18n {
	lang: string
	t: Record<string, string>
	timeZone: string
	currency: string
	dir: 'ltr' | 'rtl'
}
