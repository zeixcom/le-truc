/**
 * TSX spike (LT-183): the `.tsx` host profile's ambient declarations —
 * `server/tsrx/globals.d.ts`'s FactoryContext vocabulary, re-homed for the
 * `.tsx` surface (TSX_SPIKE.md §4.1: "FactoryContext vocabulary still
 * ambient via globals.d.ts — same mechanism"), plus the JSX
 * `IntrinsicElements` surface the `.tsrx` grammar never needed (TSRX is its
 * own grammar; `.tsx` type-checks JSX against this table).
 *
 * Two deliberate spike simplifications, to be settled by the real host
 * profile on GO:
 * - `host` is widened to `FormAssociatedElement & Record<string, any>` —
 *   the raw-source stand-in in `globals.d.ts` (`HTMLElement &
 *   Record<string, unknown>`) rejects managed-form member calls
 *   (`host.setCustomValidity(…)`) that authored form components legitimately
 *   make. The generated client keeps the precise per-component type.
 * - `IntrinsicElements` is permissive per element (`HostAttrs` accepts any
 *   attribute, so reactive thunks type-check everywhere). The §7 probes
 *   (spike/tsx/jsx-probe*.tsx) prove per-element and per-attribute strict
 *   checking WORKS when entries declare real shapes; the production profile
 *   would declare the light-DOM attribute surface per element (class/for,
 *   never className/htmlFor — those simply have no entry, so the React
 *   prior errors instead of needing the TSRX021–024 family).
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

declare const internals: ElementInternals | null

/**
 * The form-associated host contract, referenced in a source's `declare
 * global` HTMLElementTagNameMap augmentation (same alias as
 * `server/tsrx/globals.d.ts`).
 */
type FormAssociatedElement = import('@zeix/le-truc').FormAssociatedElement

/** Web Components Community Protocol helpers (ADR 0024 sub-design 15). */
declare const requestContext: LeTrucFactoryContext['requestContext']
declare const provideContexts: LeTrucFactoryContext['provideContexts']

/**
 * The host element, widened for authored form components (see the module
 * header). The compiler-supplied factory parameter carries the component's
 * real exposed props in both generated modules.
 */
declare const host: FormAssociatedElement & Record<string, any>

/** The reserved `i18n` parameter's record (ADR 0030 sub-design 2). */
interface I18n {
	lang: string
	t: Record<string, string>
	timeZone: string
	currency: string
	dir: 'ltr' | 'rtl'
}

/**
 * The recognized async-boundary call (spike spelling for `@try`/`@pending`/
 * `@catch`, §4.4): all three arms render, the compiler decides which ships.
 */
declare function boundary(arms: {
	ok: unknown
	pending: unknown
	err: (error: any) => unknown
}): unknown

// This file is a global SCRIPT (no top-level imports/exports), so the JSX
// namespace is declared at top level — the classic global-JSX pattern.
// (`declare global { … }` wrappers are only valid inside modules, which is
// why the probe .tsx files use that spelling and this file does not.)
namespace JSX {
	/** Light-DOM attribute surface: any attribute name, any value form. */
	type HostAttrs = Record<string, unknown>

	interface IntrinsicElements {
		/* Spike fixture tags (production: every corpus tag) */
		'basic-counter': HostAttrs
		'basic-pluralize': HostAttrs
		'form-combobox': HostAttrs
		'form-listbox': HostAttrs
		/* §4.4 synthetic fixtures */
		'sync-el': HostAttrs
		'async-el': HostAttrs
		/* Light-DOM elements the corpus templates use */
		button: HostAttrs
		div: HostAttrs
		input: HostAttrs
		label: HostAttrs
		li: HostAttrs
		p: HostAttrs
		span: HostAttrs
		style: HostAttrs
		ul: HostAttrs
	}
}
