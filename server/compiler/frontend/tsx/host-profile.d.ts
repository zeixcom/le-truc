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

	/**
	 * The props a JSX parent passes to a composed (PascalCase) child: the
	 * child's args minus the reserved `i18n` parameter, which the compiler
	 * supplies at every render boundary — callers never pass it (ADR 0030
	 * sub-design 2, LT-237). `children` stays: JSX children supply it.
	 * Every compose site also admits the static discriminators the
	 * compiler splices onto the child's rendered root — `class`, `id`,
	 * `data-*` — the only way to address one of two same-source sites
	 * (HOST_PROFILE § element references; LT-096).
	 */
	type LibraryManagedAttributes<_C, P> = Omit<P, 'i18n'> & ComposeSiteAttrs
	interface ComposeSiteAttrs {
		class?: string
		id?: string
		[key: `data-${string}`]: string
	}

	/** A reactive value: static, or a thunk re-evaluated client-side. */
	type Thunk<T> = () => T
	type Reactive<T> = T | Thunk<T>
	/**
	 * A light-DOM attribute value. `undefined` renders the attribute absent
	 * (`attr()` in the server runtime), so it is admitted explicitly — under
	 * `exactOptionalPropertyTypes` an optional key alone would reject it, and
	 * an `i18n` read (`placeholder={t.filter}`) is `string | undefined` under
	 * `noUncheckedIndexedAccess` (LT-237).
	 */
	type Attr<T> = Reactive<T> | undefined

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
		class?: Attr<string | null>
		hidden?: Attr<boolean>
		id?: Attr<string>
		role?: string | undefined
		tabindex?: Attr<number>
		title?: string | undefined
		'aria-label'?: Attr<string>
		'aria-live'?: 'polite' | 'assertive' | 'off' | undefined
		'aria-expanded'?: Attr<string | boolean>
		'aria-selected'?: Attr<string | boolean>
		'aria-describedby'?: string | null | undefined
		'aria-controls'?: Attr<string>
		'aria-current'?: Attr<string>
		'aria-haspopup'?: string | undefined
		'aria-labelledby'?: Attr<string>
		'aria-orientation'?: Attr<'horizontal' | 'vertical'>
		'aria-valuenow'?: Attr<string>
		'aria-valuemin'?: Attr<string>
		'aria-valuemax'?: Attr<string>
		onClick?: (event: MouseEvent) => unknown
		onInput?: (event: Event) => unknown
		onChange?: (event: Event) => unknown
		onKeydown?: (event: KeyboardEvent) => unknown
		onKeyup?: (event: KeyboardEvent) => unknown
		[key: `data-${string}`]: Attr<string>
		'truc:case'?: string | undefined
		'truc:case-type'?: 'cardinal' | 'ordinal' | undefined
		/** Sanitized raw markup, rendered before any authored children (LT-137). */
		'truc:html'?: Attr<string>
		children?: unknown
	}

	/* Light-DOM elements the corpus templates author. Extend per need —
	 * an element with NO entry here is a tsc error, which is the point:
	 * the strict table is what makes the React prior fail loudly. */
	interface button extends CommonLightDom {
		type?: 'button' | 'submit' | 'reset' | undefined
		disabled?: Attr<boolean>
	}
	interface details extends CommonLightDom {
		open?: Attr<boolean>
	}
	interface dialog extends CommonLightDom {}
	interface div extends CommonLightDom {}
	interface form extends CommonLightDom {
		method?: 'get' | 'post' | 'dialog' | undefined
	}
	interface h2 extends CommonLightDom {}
	interface header extends CommonLightDom {}
	interface input extends CommonLightDom {
		type?: string | undefined
		name?: string | undefined
		value?: Attr<string>
		placeholder?: Attr<string>
		autocomplete?: string | undefined
		min?: Attr<string>
		max?: Attr<string>
	}
	interface label extends CommonLightDom {
		/** The native attribute is `for` — there is no `htmlFor` here. */
		for?: string | undefined
	}
	interface code extends CommonLightDom {}
	interface dd extends CommonLightDom {
		/** A fixed-language island (module-colorinfo's `oklch(…)` line). */
		lang?: string | undefined
	}
	interface dl extends CommonLightDom {}
	interface dt extends CommonLightDom {}
	interface small extends CommonLightDom {}
	interface strong extends CommonLightDom {}
	interface summary extends CommonLightDom {}
	interface li extends CommonLightDom {}
	interface p extends CommonLightDom {}
	interface pre extends CommonLightDom {}
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
	type ModuleCodeblockAttrs = CommonLightDom & {
		collapsed?: Reactive<boolean>
		language?: string
	}
	type ModuleCatalogAttrs = CommonLightDom
	type ModuleColorinfoAttrs = CommonLightDom & {
		value?: Reactive<string>
		/** Server-rendered swatch properties; `bindStyle` owns them after connect. */
		style?: string
	}
	type ModuleDialogAttrs = CommonLightDom
	type ModuleSplitviewAttrs = CommonLightDom & {
		split?: Reactive<number>
		/** Server-rendered initial ratio; the `split` watcher owns it after connect. */
		style?: string
		/** Config-only: read once at connect, not a reactive property. */
		orientation?: 'horizontal' | 'vertical' | undefined
	}
	type ModulePaginationAttrs = CommonLightDom & {
		max?: Reactive<number>
		value?: Reactive<number>
	}
	/** Its light-DOM config attribute: read once at connect, not a reactive property. */
	type ModuleScrollareaAttrs = CommonLightDom & {
		orientation?: 'horizontal' | 'vertical' | undefined
	}
	type SyncElAttrs = CommonLightDom & {
		mode?: string
		items?: unknown
	}
	type AsyncElAttrs = CommonLightDom

	interface IntrinsicElements {
		button: button
		dd: dd
		details: details
		dialog: dialog
		dl: dl
		dt: dt
		div: div
		form: form
		h2: h2
		header: header
		input: input
		code: code
		label: label
		li: li
		p: p
		pre: pre
		small: small
		span: span
		strong: strong
		summary: summary
		ul: ul
		style: style
		'basic-counter': BasicCounterAttrs
		'basic-pluralize': BasicPluralizeAttrs
		'basic-number': BasicNumberAttrs
		'form-combobox': FormComboboxAttrs
		'form-listbox': FormListboxAttrs
		'module-codeblock': ModuleCodeblockAttrs
		'module-catalog': ModuleCatalogAttrs
		'module-colorinfo': ModuleColorinfoAttrs
		'module-dialog': ModuleDialogAttrs
		'module-pagination': ModulePaginationAttrs
		'module-scrollarea': ModuleScrollareaAttrs
		'module-splitview': ModuleSplitviewAttrs
		'sync-el': SyncElAttrs
		'async-el': AsyncElAttrs
	}
}
