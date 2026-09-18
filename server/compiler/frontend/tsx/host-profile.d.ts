/**
 * The `.tsx` host profile (ADR 0032 sub-design 3; hardened by LT-203).
 * Ambient declarations for `.tsx`-authored components: the FactoryContext
 * vocabulary (re-homed from `server/compiler/frontend/tsrx/globals.d.ts`, which serves the
 * raw `.tsrx` view) plus the JSX `IntrinsicElements` surface the `.tsrx`
 * grammar never needed.
 *
 * The two profiles are siblings, never roommates: both declare the same
 * ambient names in the global scope, so an authored-.tsx tsconfig includes
 * THIS file and a raw-.tsrx view includes `globals.d.ts` — never both (the
 * repo root's typecheck excludes this file for the same reason).
 *
 * Profile decisions (LT-203):
 * - `host` is widened to `FormAssociatedElement & Record<string, any>` —
 *   managed-form member calls (`host.setCustomValidity(…)`) that authored
 *   form components legitimately make must type-check against the ambient
 *   (the raw-source stand-in `HTMLElement & Record<string, unknown>`
 *   rejects them). The GENERATED client keeps the component's precise
 *   per-property types; this ambient is the authored-source stand-in only,
 *   exactly like `globals.d.ts`'s, one step wider for the form surface.
 * - `IntrinsicElements` is STRICT per element: each entry names its
 *   light-DOM attributes (thunk overloads where a value may react),
 *   `class`/`for` — `className`/`htmlFor` simply have no entry, so the
 *   React prior produces a plain tsc error (the TSRX021–024 family stays
 *   in force for `.tsrx` sources only). `data-*` is open through a
 *   pattern index signature; `truc:case`/`truc:case-type` are compiler-
 *   consumed on every element. `truc:pass` is deliberately NOT in the
 *   common set — a pass replaces a child's Slot, so only pass TARGETS
 *   declare one, mirroring the `'truc:pass'` key on their args types.
 * - Wave-4 rule: every migrated tag gains its entry here in the same
 *   commit as the migration (the table is the tag's light-DOM contract).
 */

type LeTrucFactoryContext = import('@zeix/le-truc').FactoryContext<
	// `ComponentProps` constrains values to `NonNullable<unknown>` (`{}`),
	// so plain `unknown` does not satisfy it. This ambient never names a
	// component's real props — the generated modules do — so the widest
	// SATISFYING record is the right stand-in.
	Record<string, NonNullable<unknown>>
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
 * `server/compiler/frontend/tsrx/globals.d.ts`).
 */
type FormAssociatedElement = import('@zeix/le-truc').FormAssociatedElement

/** Web Components Community Protocol helpers (ADR 0024 sub-design 15). */
declare const requestContext: LeTrucFactoryContext['requestContext']
declare const provideContexts: LeTrucFactoryContext['provideContexts']

/**
 * The host element. The compiler-supplied factory parameter carries the
 * component's real exposed props in both generated modules; this ambient
 * is the authored-source stand-in (see the module header).
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
 * The recognized async boundary (the `.tsx` spelling of
 * `@try`/`@pending`/`@catch`): all arms render, `hidden`-toggled by which
 * state won at render time. `nil` is the no-value-yet arm. There is no
 * `stale` arm — the owner withdrew the four-arm spelling (LT-211): a
 * re-fetching task keeps its `ok` arm, and the in-flight state is the
 * reactive `isPending` idiom beside the boundary (`isPending` is a real
 * package export — import it; the compiler folds the read server-side and
 * the generated `watch` re-fires when the task settles).
 *
 * Typed precisely per the owner precision ruling (LT-208): every arm IS a
 * JSX element expression — the compiler's `singleRootOf` checks are the
 * semantics — so the arm positions are `JSX.Element` (branded, below), and
 * `err`'s parameter is `Error` because cause-effect's `match()` wraps
 * non-Errors before dispatch. Deliberately NOT generic `boundary<T>`: a
 * divergent arm ("oops" beside `<div/>`) would union `T` and pass.
 */
declare function boundary(arms: {
	ok: JSX.Element
	nil: JSX.Element
	err: (error: Error) => JSX.Element
}): JSX.Element

/**
 * The CSS template tag (LT-202): `<style>{css`…`}</style>` is the default
 * spelling for a component's stylesheet — editors highlight a `css`-tagged
 * template literal as CSS out of the box. The tag is compile-consumed:
 * evaluated by nothing, and a `${}` substitution inside is rejected by the
 * compiler (typed `never` here so authored code hears the same thing from
 * tsc). A bare template literal still works, but `css` is what the profile
 * teaches.
 */
declare function css(
	source: TemplateStringsArray,
	...substitutions: never[]
): string

// This file is a global SCRIPT (no top-level imports/exports), so the JSX
// namespace is declared at top level — the classic global-JSX pattern.
// (`declare global { … }` wrappers are only valid inside modules, which is
// why the probe .tsx files use that spelling and this file does not —
// LT-183 spike findings fact 2, adr/archive/0032-spike-findings.md.)
// biome-ignore lint/style/noNamespace: global-script .d.ts has no module-free alternative for JSX.IntrinsicElements
declare namespace JSX {
	/**
	 * The type of every JSX element expression (LT-208): branded so a
	 * boundary arm position (`ok`/`nil`, and `err`'s return) rejects
	 * anything that is not an element — a string, number, or function arm
	 * is a tsc error, which the generic-`T` and empty-`{}` attempts could
	 * not deliver. An element expression satisfies the brand by
	 * construction: its type IS this interface.
	 */
	interface Element {
		readonly $$leTrucJsx: 'element'
	}

	/** A reactive value: static, or a thunk re-evaluated client-side. */
	type Thunk<T> = () => T
	type Reactive<T> = T | Thunk<T>

	/**
	 * One `truc:pass` entry: a read-only thunk, or a mediated descriptor —
	 * the same shapes `pass()` accepts (ADR 0012's post-short-form input
	 * set). Which PROPS a child exposes is declared per element below,
	 * mirroring the child's own `'truc:pass'` args key.
	 */
	type PassEntry =
		| Thunk<unknown>
		| { get: Thunk<unknown>; set: (value: unknown) => void }

	/**
	 * The light-DOM attribute surface every element shares: global
	 * attributes, the ARIA names the corpus templates use, the corpus's
	 * event vocabulary (an `on()` handler may return a partial host update),
	 * and the compiler-consumed `truc:case` pruning directives. `truc:pass`
	 * is deliberately absent — see the module header.
	 */
	interface CommonLightDom {
		class?: Reactive<string | null>
		hidden?: Reactive<boolean>
		id?: Reactive<string>
		role?: string
		tabindex?: Reactive<number>
		title?: string
		'aria-label'?: Reactive<string>
		'aria-live'?: 'polite' | 'assertive' | 'off'
		'aria-expanded'?: Reactive<string | boolean>
		'aria-selected'?: Reactive<string | boolean>
		'aria-describedby'?: string | null
		onClick?: (event: MouseEvent) => unknown
		onInput?: (event: Event) => unknown
		onChange?: (event: Event) => unknown
		onKeydown?: (event: KeyboardEvent) => unknown
		onKeyup?: (event: KeyboardEvent) => unknown
		[key: `data-${string}`]: Reactive<string>
		'truc:case'?: string
		'truc:case-type'?: 'cardinal' | 'ordinal' | undefined
		children?: unknown
	}

	/* Light-DOM elements the corpus templates author. Extend per need —
	 * an element with NO entry here is a tsc error, which is the point:
	 * the strict table is what makes the React prior fail loudly. */
	interface button extends CommonLightDom {
		type?: 'button' | 'submit' | 'reset'
		disabled?: Reactive<boolean>
	}
	interface div extends CommonLightDom {}
	interface form extends CommonLightDom {}
	interface input extends CommonLightDom {
		type?: string
		name?: string
		value?: Reactive<string>
		placeholder?: Reactive<string>
		autocomplete?: string
	}
	interface label extends CommonLightDom {
		/** The native attribute is `for` — there is no `htmlFor` here. */
		for?: string
	}
	interface li extends CommonLightDom {}
	interface p extends CommonLightDom {}
	interface span extends CommonLightDom {}
	interface ul extends CommonLightDom {}
	/** A component's stylesheet: content only, no attributes. */
	interface style {
		children?: unknown
	}

	/* Component tags — the light-DOM surface of each migrated fixture, plus
	 * the composed children that declare a pass surface. Wave-4 migrations
	 * extend this list in the same commit as the migration. (The shapes are
	 * type aliases because a quoted interface name is not legal TS; the
	 * IntrinsicElements entries key them by tag.) */
	type BasicCounterAttrs = CommonLightDom & {
		start?: Reactive<number>
	}
	type BasicPluralizeAttrs = CommonLightDom & {
		count: Reactive<number>
		/** Config-only (built-in IDL property — never an exposed prop). */
		lang?: string
		ordinal?: Reactive<boolean>
	}
	type BasicNumberAttrs = CommonLightDom & {
		value?: Reactive<number>
		options?: string
		'truc:pass'?: { value?: PassEntry }
	}
	type FormComboboxAttrs = CommonLightDom & {
		name: Reactive<string>
		label?: string
		description?: string
		value?: Reactive<string>
		options?: unknown
		clearable?: Reactive<boolean>
	}
	type FormListboxAttrs = CommonLightDom & {
		name: Reactive<string>
		'aria-label'?: string
		value?: Reactive<string>
		options?: unknown
		filterable?: Reactive<boolean>
		'truc:pass'?: { filter?: PassEntry }
	}
	type SyncElAttrs = CommonLightDom & {
		mode?: string
		items?: unknown
	}
	type AsyncElAttrs = CommonLightDom

	interface IntrinsicElements {
		button: button
		div: div
		form: form
		input: input
		label: label
		li: li
		p: p
		span: span
		ul: ul
		style: style
		'basic-counter': BasicCounterAttrs
		'basic-pluralize': BasicPluralizeAttrs
		'basic-number': BasicNumberAttrs
		'form-combobox': FormComboboxAttrs
		'form-listbox': FormListboxAttrs
		'sync-el': SyncElAttrs
		'async-el': AsyncElAttrs
	}
}
