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
 *   pattern index signature. `truc:pass` is deliberately NOT in the
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

/**
 * A message's argument record (LT-308): an ICU argument is formatted as a
 * number, a date, or a plain string.
 */
type MessageArgs = Record<string, string | number | Date>

/**
 * One `t.<key>` read, typed from its source pattern's literal type (LT-308,
 * ADR 0030 s4): a pattern without `{` is a string, one with `{` takes
 * arguments and is a function of its argument record. A widened `string`
 * (the `as const` was forgotten) is the union, so its first attribute read
 * fails tsc instead of passing silently. An ICU-escaped literal brace
 * (`'{'`) misclassifies an argument-less message as a function here — the
 * compiler's argument diagnostic and the generated modules' types are exact.
 */
type MessageOf<V> = string extends V
	? string | ((args: MessageArgs) => string)
	: V extends `${string}{${string}`
		? (args: MessageArgs) => string
		: string

/**
 * The reserved `i18n` parameter's record (ADR 0030 sub-design 2), typed per
 * key from the component's `export const i18n = { … } as const`: annotate
 * `i18n: I18n<typeof i18n>` (LT-308).
 */
interface I18n<M extends Record<string, string> = Record<string, string>> {
	lang: string
	t: { readonly [K in keyof M]: MessageOf<M[K]> }
	timeZone: string
	currency: string
	dir: 'ltr' | 'rtl'
}

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
	 * `<truc:try>` arm position (`pending`, and `catch`'s return) rejects
	 * anything that is not an element — a string, number, or function arm
	 * is a tsc error, which the generic-`T` and empty-`{}` attempts could
	 * not deliver. An element expression satisfies the brand by
	 * construction: its type IS this interface.
	 */
	interface Element {
		readonly $$leTrucJsx: 'element'
	}

	/**
	 * JSX children are checked against the `children` prop — what makes
	 * `<truc:try>`'s single-element content (`children: Element`) a tsc
	 * fact. Every other entry types `children` as `unknown`.
	 */
	interface ElementChildrenAttribute {
		children: unknown
	}

	/**
	 * The props a JSX parent passes to a composed (PascalCase) child: the
	 * child's args minus the reserved `i18n` parameter, which the compiler
	 * supplies at every render boundary — callers never pass it (ADR 0030
	 * sub-design 2, LT-237). `children` stays: JSX children supply it.
	 * Every compose site also admits the static discriminators the
	 * compiler splices onto the child's rendered root — `class`, `id`,
	 * `data-*` — the only way to address one of two same-source sites
	 * (HOST_PROFILE § element references; LT-096). The omission distributes
	 * over a union of arg shapes, so a discriminated args type keeps its
	 * discrimination at the compose site (module-codeblock: collapsed ⇒ `id`,
	 * LT-343) — a plain `Omit` would flatten it to the members' common keys.
	 */
	type LibraryManagedAttributes<_C, P> = (P extends unknown
		? Omit<P, 'i18n'>
		: never) &
		ComposeSiteAttrs
	interface ComposeSiteAttrs {
		class?: string
		id?: string
		[key: `data-${string}`]: string
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
	 * and `truc:html`. `truc:pass` is deliberately absent — see the module
	 * header.
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
		'aria-controls'?: Reactive<string>
		'aria-current'?: Reactive<string>
		'aria-haspopup'?: string
		'aria-labelledby'?: Reactive<string>
		'aria-orientation'?: Reactive<'horizontal' | 'vertical'>
		'aria-valuenow'?: Reactive<string>
		'aria-valuemin'?: Reactive<string>
		'aria-valuemax'?: Reactive<string>
		onClick?: (event: MouseEvent) => unknown
		onInput?: (event: Event) => unknown
		onChange?: (event: Event) => unknown
		onKeydown?: (event: KeyboardEvent) => unknown
		onKeyup?: (event: KeyboardEvent) => unknown
		[key: `data-${string}`]: Reactive<string>
		/** Sanitized raw markup, rendered before any authored children (LT-137). */
		'truc:html'?: Reactive<string>
		children?: unknown
	}

	/* Light-DOM elements the corpus templates author. Extend per need —
	 * an element with NO entry here is a tsc error, which is the point:
	 * the strict table is what makes the React prior fail loudly. */
	interface button extends CommonLightDom {
		type?: 'button' | 'submit' | 'reset'
		disabled?: Reactive<boolean>
	}
	interface details extends CommonLightDom {
		open?: Reactive<boolean>
	}
	interface dialog extends CommonLightDom {}
	interface div extends CommonLightDom {}
	interface form extends CommonLightDom {
		method?: 'get' | 'post' | 'dialog'
	}
	interface h2 extends CommonLightDom {}
	interface h3 extends CommonLightDom {}
	interface header extends CommonLightDom {}
	interface input extends CommonLightDom {
		type?: string
		name?: string
		value?: Reactive<string>
		placeholder?: Reactive<string>
		autocomplete?: string
		min?: Reactive<string>
		max?: Reactive<string>
	}
	interface label extends CommonLightDom {
		/** The native attribute is `for` — there is no `htmlFor` here. */
		for?: string
	}
	interface code extends CommonLightDom {}
	interface dd extends CommonLightDom {
		/** A fixed-language island (module-colorinfo's `oklch(…)` line). */
		lang?: string
	}
	interface dl extends CommonLightDom {}
	interface dt extends CommonLightDom {}
	interface small extends CommonLightDom {}
	interface strong extends CommonLightDom {}
	interface summary extends CommonLightDom {}
	interface li extends CommonLightDom {}
	/** schema.org microdata, the attributes basic-blogmeta's byline carries. */
	interface Microdata {
		itemprop?: string
		itemscope?: boolean
		itemtype?: string
	}
	interface img extends CommonLightDom, Microdata {
		src?: Reactive<string>
		alt?: Reactive<string>
	}
	interface meta extends CommonLightDom, Microdata {
		content?: Reactive<string>
	}
	interface time extends CommonLightDom, Microdata {
		datetime?: Reactive<string>
	}
	interface svg extends CommonLightDom {
		viewBox?: string
		fill?: string
		focusable?: 'true' | 'false'
	}
	interface path extends CommonLightDom {
		d?: string
		'fill-rule'?: 'nonzero' | 'evenodd'
	}
	interface nav extends CommonLightDom {}
	interface p extends CommonLightDom {}
	interface pre extends CommonLightDom {}
	interface span extends CommonLightDom, Microdata {}
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
	/** Its own `id` mirrors an optional arg: absent when the caller passes none. */
	type ModuleCodeblockAttrs = Omit<CommonLightDom, 'id'> & {
		id?: string | undefined
		collapsed?: Reactive<boolean>
		language?: string
	}
	type BasicBlogmetaAttrs = CommonLightDom
	type ModuleCarouselAttrs = CommonLightDom
	type ModuleCatalogAttrs = CommonLightDom
	type ModuleColoreditorAttrs = CommonLightDom & {
		/** Parser-backed: read once at connect; the `value` property owns it after. */
		value?: string
		/** Parser-backed: read once at connect; the `label` property owns it after. */
		label?: string
	}
	type ModuleColorinfoAttrs = CommonLightDom & {
		value?: Reactive<string>
		/** Server-rendered swatch properties; `bindStyle` owns them after connect. */
		style?: string
	}
	type ModuleDialogAttrs = CommonLightDom
	type ModuleListnavAttrs = CommonLightDom
	type ModuleLazyloadAttrs = CommonLightDom & {
		/** Parser-backed: read once at connect; the `src` property owns it after. */
		src?: string | undefined
		/** Config-only, presence-read once at connect: not a reactive property. */
		'allow-scripts'?: boolean | undefined
	}
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
	/** Breakpoint config attributes, each read once at connect. */
	type ContextMediaAttrs = CommonLightDom & {
		sm?: string | undefined
		md?: string | undefined
		lg?: string | undefined
		xl?: string | undefined
	}
	/** A `.tsrx` leaf authored raw: its `kind` class is the only contract. */
	type CardCalloutAttrs = CommonLightDom
	type SyncElAttrs = CommonLightDom & {
		mode?: string
		items?: unknown
	}
	type AsyncElAttrs = CommonLightDom

	/**
	 * `<truc:try>` (ADR 0041), the `.tsx` spelling of
	 * `@try`/`@pending`/`@catch`. The children are the success content.
	 * With `catch` only it is the error boundary; adding `pending` makes it
	 * the async boundary — all arms render, `hidden`-toggled by which state
	 * won at render time, and `pending` is the no-value-yet arm. There is no
	 * `stale` arm (LT-211): a re-fetching task keeps its content, and the
	 * in-flight state is the reactive `isPending` idiom beside the boundary
	 * (`isPending` is a real package export — import it; the compiler folds
	 * the read server-side and the generated `watch` re-fires when the task
	 * settles).
	 *
	 * Typed precisely per the owner precision ruling (LT-208): every arm IS
	 * a JSX element expression — the compiler's `singleRootOf` checks are
	 * the semantics — so the arm positions are the branded `JSX.Element`,
	 * and `catch`'s parameter is `Error` because cause-effect's `match()`
	 * wraps non-Errors before dispatch. As attributes, a repeated arm is a
	 * tsc error (TS17001). Compile-consumed: nothing evaluates the arms.
	 */
	interface TrucTryAttrs {
		pending?: Element
		catch: (error: Error) => Element
		children: Element
	}

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
		h3: h3
		header: header
		input: input
		code: code
		label: label
		img: img
		li: li
		meta: meta
		path: path
		nav: nav
		p: p
		pre: pre
		small: small
		span: span
		svg: svg
		time: time
		strong: strong
		summary: summary
		ul: ul
		style: style
		'basic-blogmeta': BasicBlogmetaAttrs
		'basic-counter': BasicCounterAttrs
		'card-callout': CardCalloutAttrs
		'context-media': ContextMediaAttrs
		'basic-pluralize': BasicPluralizeAttrs
		'basic-number': BasicNumberAttrs
		'form-combobox': FormComboboxAttrs
		'form-listbox': FormListboxAttrs
		'module-codeblock': ModuleCodeblockAttrs
		'module-carousel': ModuleCarouselAttrs
		'module-catalog': ModuleCatalogAttrs
		'module-coloreditor': ModuleColoreditorAttrs
		'module-colorinfo': ModuleColorinfoAttrs
		'module-dialog': ModuleDialogAttrs
		'module-lazyload': ModuleLazyloadAttrs
		'module-listnav': ModuleListnavAttrs
		'module-pagination': ModulePaginationAttrs
		'module-scrollarea': ModuleScrollareaAttrs
		'module-splitview': ModuleSplitviewAttrs
		'sync-el': SyncElAttrs
		'async-el': AsyncElAttrs
		'truc:try': TrucTryAttrs
	}
}
