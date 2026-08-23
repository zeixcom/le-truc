/**
 * Compile diagnostics for the inlined TSRX compiler (ADR 0023).
 *
 * Diagnostics are the compiler's product surface: a wrong rewrite is a wrong
 * component, so every rule that cannot be applied reports a code, a message,
 * and — where the author can act on it — a suggested fix. `severity` decides
 * how the build effect treats a file (see effects/tsrx.ts): errors fail the
 * build, known milestone gates warn and skip the file.
 */

/* === Types === */

export type DiagnosticCode =
	| 'TSRX001' // @for over a reactive source that is not a declared createList
	| 'TSRX002' // loop variable referenced inside a reactive thunk — hoist it first
	| 'TSRX003' // hoisted const not rebindable to a server-rendered attribute
	| 'TSRX004' // signal with no harvestable initial-DOM site
	| 'TSRX005' // construct outside the sanctioned milestone-2 subset
	| 'TSRX006' // malformed or unsupported attribute shape
	| 'TSRX007' // template structure the compiler cannot address
	| 'TSRX008' // source shape violation (root tag, exports, style placement)
	| 'TSRX009' // invalid `export const config` extension declaration
	| 'TSRX010' // managed form prop used without formAssociated
	| 'TSRX011' // composed (PascalCase) element with no resolvable .tsrx import
	| 'TSRX012' // pass={{ }}/reactive dispatch legality on a custom-element target

export type CompileDiagnostic = {
	code: DiagnosticCode
	severity: 'error' | 'warning'
	message: string
	/** 1-based line in the .tsrx source, when known. */
	line?: number
}

/* === Internal Functions === */

const error = (
	code: DiagnosticCode,
	message: string,
	line?: number,
): CompileDiagnostic =>
	line === undefined
		? { code, severity: 'error', message }
		: { code, severity: 'error', message, line }

const warning = (
	code: DiagnosticCode,
	message: string,
	line?: number,
): CompileDiagnostic =>
	line === undefined
		? { code, severity: 'warning', message }
		: { code, severity: 'warning', message, line }

const lineOf = (
	source: string,
	offset: number | undefined,
): number | undefined => {
	if (offset === undefined || offset < 0 || offset > source.length)
		return undefined
	let line = 1
	for (let i = 0; i < offset; i++) if (source.charCodeAt(i) === 10) line++
	return line
}

/* === Exported Functions === */

export const diagnostic = {
	/**
	 * `@for` over a reactive source that is not a declared `createList` — the
	 * reconcile lowering (milestone 3) covers declared Lists only.
	 */
	reactiveForNotSupported: (
		source: string,
		offset?: number,
		iterable?: string,
	) =>
		warning(
			'TSRX001',
			`@for over reactive source \`${iterable ?? '?'}\` — only declared createList(…) signals lower (reconcile(), ADR 0017); derived or non-List reactive sources are not supported. File skipped.`,
			lineOf(source, offset),
		),

	/** Loop variable used inside a reactive thunk — the hoist-first rule. */
	loopVariableInReactiveThunk: (
		source: string,
		offset: number | undefined,
		names: string[],
	) =>
		error(
			'TSRX002',
			`Reactive expressions must not reference @for variables directly (${names.map(n => `\`${n}\``).join(', ')}). Hoist the derived value into a const first (e.g. \`const pid = panelId(tab.id)\`) so the client can rebind it to a server-rendered attribute.`,
			lineOf(source, offset),
		),

	/** Hoisted const referenced reactively but never rendered as a bare attribute. */
	constNotRebindable: (
		source: string,
		offset: number | undefined,
		name: string,
		element: string,
	) =>
		error(
			'TSRX003',
			`Hoisted const \`${name}\` is referenced by a reactive expression but never rendered as a bare attribute of <${element}>, so the client cannot rebind it. Render it (e.g. \`aria-controls={${name}}\` or a \`data-\` attribute) or stop referencing it reactively.`,
			lineOf(source, offset),
		),

	/** Signal the client cannot seed from the server-rendered DOM. */
	signalNotHarvestable: (
		source: string,
		offset: number | undefined,
		name: string,
	) =>
		error(
			'TSRX004',
			`Signal \`${name}\` is never rendered into the DOM, so the client cannot harvest its initial value (ADR 0003: DOM is the truth at load time). Render it — &{${name}} as a child or an attribute thunk — or remove it.`,
			lineOf(source, offset),
		),

	/** Anything outside the sanctioned milestone-2 construct set. */
	unsupported: (source: string, offset: number | undefined, what: string) =>
		error(
			'TSRX005',
			`${what} is outside the sanctioned milestone-2 subset of ADR 0023. Supported: text/attribute/class reactive bindings, event attributes, refs, @for over server data, hoisted-const rebinding, harvest rules.`,
			lineOf(source, offset),
		),

	/** Attribute shape the classifier does not accept. */
	invalidAttribute: (
		source: string,
		offset: number | undefined,
		what: string,
	) => error('TSRX006', what, lineOf(source, offset)),

	/** Element the generated client cannot address deterministically. */
	unaddressableElement: (
		source: string,
		offset: number | undefined,
		what: string,
	) => error('TSRX007', what, lineOf(source, offset)),

	/** Source-level structure violations. */
	invalidSource: (what: string) => error('TSRX008', what, undefined),

	/** Invalid `export const config` declaration (ADR 0023 sub-design 8). */
	invalidConfig: (source: string, offset: number | undefined, what: string) =>
		error('TSRX009', what, lineOf(source, offset)),

	/**
	 * Managed form prop (`&{'validationMessage'}`) without `formAssociated` —
	 * the watch source exists only on FormFactoryContext (LT-008).
	 */
	managedPropWithoutForm: (
		source: string,
		offset: number | undefined,
		prop: string,
	) =>
		error(
			'TSRX010',
			`Lazy child &{'${prop}'} names a managed form prop — it is watchable only when formAssociated() leads the extensions. Declare \`export const config = { formAssociated: true }\` or expose a prop of that name.`,
			lineOf(source, offset),
		),

	/**
	 * A capitalized JSX tag with no matching `import { Name } from '….tsrx'`
	 * (ADR 0023 sub-design 10) — composition resolves by import, never falls
	 * back to raw custom-element treatment.
	 */
	unresolvedComposedComponent: (
		source: string,
		offset: number | undefined,
		name: string,
	) =>
		error(
			'TSRX011',
			`\`<${name}>\` has no matching \`import { ${name} } from '….tsrx'\` — composed (capitalized) tags must import the component they compose (ADR 0023 sub-design 10). A lowercase dashed tag addresses a raw custom element instead.`,
			lineOf(source, offset),
		),

	/**
	 * A composed element's import resolved to a `.tsrx` path, but that file
	 * did not compile (or does not exist) — a cross-file resolution failure,
	 * distinct from the "no matching import" case above.
	 */
	composedComponentNotCompiled: (
		source: string,
		offset: number | undefined,
		name: string,
		path: string,
	) =>
		error(
			'TSRX011',
			`\`<${name}>\` composes \`${path}\`, but that file did not compile (or was not found) — fix its own diagnostics first.`,
			lineOf(source, offset),
		),

	/** A construct on a composed element that composition does not support yet. */
	composedElementUnsupported: (
		source: string,
		offset: number | undefined,
		what: string,
	) =>
		error(
			'TSRX011',
			`${what} on a composed element is not supported yet (queued: ADR 0023 sub-design 10 follow-up tasks).`,
			lineOf(source, offset),
		),

	/**
	 * A function-valued attribute on a custom-element target (ADR 0023
	 * sub-design 4, amended by sub-design 10) — reactive-shape inference on
	 * custom elements is gone; `pass={{ }}` is the sole client-prop channel.
	 */
	reactiveAttrOnCustomElement: (
		source: string,
		offset: number | undefined,
		tag: string,
		attr: string,
	) =>
		error(
			'TSRX012',
			`Reactive attribute \`${attr}={…}\` on custom element <${tag}> is no longer bound to anything (ADR 0023 sub-design 10) — use \`pass={{ ${attr}: ${attr} }}\` for client-side signal interop, or a plain value for a static attribute.`,
			lineOf(source, offset),
		),

	/** `pass={{ }}` on a native element or an unregistered/unknown custom tag. */
	passTargetNotCustom: (
		source: string,
		offset: number | undefined,
		tag: string,
	) =>
		error(
			'TSRX012',
			`pass={{ … }} on <${tag}> — its target must be a registry-known custom element (ADR 0023 sub-design 10); native elements use reactive attribute bindings instead.`,
			lineOf(source, offset),
		),

	/**
	 * `pass={{ }}` on a composed element without an explicit `ref` — selector
	 * synthesis for a composed target isn't attempted from server args (they
	 * aren't guaranteed to render as DOM attributes), so addressing needs the
	 * author's own `ref`.
	 */
	composedPassRequiresRef: (
		source: string,
		offset: number | undefined,
		component: string,
	) =>
		error(
			'TSRX012',
			`pass={{ … }} on <${component}> needs an explicit ref={name} — a composed element's server args aren't guaranteed to render as DOM attributes, so it can't be auto-addressed the way native/raw custom elements are.`,
			lineOf(source, offset),
		),

	/** Recompute a diagnostic's line from a node offset (keeps messages stable). */
	withLine: (
		d: CompileDiagnostic,
		source: string,
		offset: number | undefined,
	) => ({
		...d,
		line: lineOf(source, offset),
	}),
}
