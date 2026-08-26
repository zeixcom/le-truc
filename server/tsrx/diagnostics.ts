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
	| 'TSRX013' // signal declared with a conditionally-chosen constructor, or a client-only primitive called from a plain setup const
	| 'TSRX014' // plain (non-.tsrx) import whose bindings are never used anywhere the compiler can place them
	| 'TSRX015' // requestContext() called with other than exactly two arguments
	| 'TSRX016' // requestContext()'s fallback argument is not server-known
	| 'TSRX017' // template child whose reactivity cannot be traced — needs a thunk
	| 'TSRX018' // retired `&{}` lazy-child sigil
	| 'TSRX019' // string-literal prop name in child position — write host.<prop>
	| 'TSRX020' // lazy destructuring pattern — not applicable to the Le Truc profile

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
			`Signal \`${name}\` is never rendered into the DOM, so the client cannot harvest its initial value (ADR 0003: DOM is the truth at load time). Render it — \`{${name}}\` as a child or an attribute thunk — or remove it.`,
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
	 * Managed form prop (`{host.validationMessage}`) without `formAssociated`
	 * — the watch source exists only on FormFactoryContext (LT-008).
	 */
	managedPropWithoutForm: (
		source: string,
		offset: number | undefined,
		prop: string,
	) =>
		error(
			'TSRX010',
			`\`{host.${prop}}\` reads a managed form prop — it is watchable only when formAssociated() leads the extensions. Declare \`export const config = { formAssociated: true }\` or expose a prop of that name.`,
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

	/**
	 * A setup const's initializer conditionally chooses between two signal-
	 * constructor calls (`cond ? deriveCell(...) : createCell(...)`) — the
	 * initializer must be a SINGLE, unconditional call to a recognized
	 * constructor; conditional logic belongs inside the callback, not as a
	 * choice between constructors (ADR 0023 sub-design 12).
	 */
	conditionalSignalConstructor: (
		source: string,
		offset: number | undefined,
		name: string,
	) =>
		error(
			'TSRX013',
			`\`${name}\`'s initializer conditionally chooses between two signal-constructor calls — a signal must be a single, unconditional call to a recognized constructor (createCell/createState/deriveCell/…). Move the condition inside the callback instead (e.g. \`deriveCell(() => cond ? a : b)\`).`,
			lineOf(source, offset),
		),

	/**
	 * A plain (non-signal) setup const calls a client-only DOM/context
	 * primitive directly — `component.setup` is emitted verbatim into the
	 * SERVER render function, where `first`/`all`/`watch`/`on`/`pass` don't
	 * exist (ADR 0023 sub-design 12).
	 */
	clientOnlySetupConst: (
		source: string,
		offset: number | undefined,
		name: string,
		primitives: string[],
	) =>
		error(
			'TSRX013',
			`\`${name}\` calls client-only primitive(s) ${primitives.map(p => `\`${p}\``).join(', ')} — plain setup consts run server-side too (component.setup is emitted verbatim into the render function), where these don't exist. Use a signal constructor (the client seeds it from the DOM) or a client-only setup statement instead.`,
			lineOf(source, offset),
		),

	/**
	 * A `deriveCell`/`deriveStore`/`createMemo` compute function references
	 * `host`/`internals` — these derived constructors invoke their compute
	 * function synchronously at server-render time too (runtime.ts), where
	 * `host`/`internals` don't exist (same verbatim-re-declaration rule as
	 * `clientOnlySetupConst`, ADR 0023 sub-design 12; surfaced by LT-025's
	 * `createMemo` support, the common shape for a derived-over-host-prop
	 * memo, e.g. `createMemo(() => host.filter.toLowerCase())`).
	 */
	clientOnlySignalCompute: (
		source: string,
		offset: number | undefined,
		name: string,
		ctor: string,
		badNames: string[],
	) =>
		error(
			'TSRX013',
			`\`${name}\`'s ${ctor}(...) compute function references ${badNames.map(n => `\`${n}\``).join(', ')} — ${ctor} runs server-side too (component.setup is emitted verbatim into the render function), where these don't exist. Derive from a server-known signal/param instead, or move the ${badNames.join('/')} read into a client-only construct (e.g. a reactive attribute thunk).`,
			lineOf(source, offset),
		),

	/**
	 * A plain (non-`.tsrx`) import whose local bindings never appear as a
	 * free identifier anywhere in setup or the template (LT-034, ADR 0024
	 * sub-design 14) — placement is inferred from usage, so an import with no
	 * detectable usage would otherwise be silently dropped rather than fail
	 * loudly.
	 */
	unusedPlainImport: (
		source: string,
		offset: number | undefined,
		names: string[],
	) =>
		warning(
			'TSRX014',
			`Import ${names.map(n => `\`${n}\``).join(', ')} is never referenced in setup code or the template — it would be dropped from both generated modules. Remove it, or use it so the compiler can place it.`,
			lineOf(source, offset),
		),

	/**
	 * `requestContext(...)` called with other than exactly two arguments
	 * (LT-035, ADR 0024 sub-design 15) — `requestContext(context, fallback)`
	 * is the only recognized shape; the server needs the second argument as
	 * the signal's render-time value (there is no ancestor DOM to walk).
	 */
	invalidRequestContextCall: (
		source: string,
		offset: number | undefined,
		name: string,
	) =>
		error(
			'TSRX015',
			`\`${name} = requestContext(...)\` must be called with exactly two arguments: the context key and a fallback value. The fallback is what the server renders (ADR 0024 sub-design 15) — there is no ancestor DOM to walk at render time.`,
			lineOf(source, offset),
		),

	/**
	 * `requestContext(context, fallback)`'s fallback argument references a
	 * name the server cannot resolve (LT-035) — the server substitutes the
	 * fallback for the whole call (`requestContext` itself is a client-only
	 * ambient), so the fallback must be a literal or an expression over
	 * server args/setup, the same rule other server-rendered thunks follow.
	 */
	contextFallbackNotServerKnown: (
		source: string,
		offset: number | undefined,
		name: string,
		names: string[],
	) =>
		error(
			'TSRX016',
			`\`${name}\`'s fallback argument references ${names.map(n => `\`${n}\``).join(', ')}, which the server cannot resolve — requestContext()'s fallback must be a literal or an expression over server args/setup, since the server renders using it directly (no ancestor DOM to walk at render time).`,
			lineOf(source, offset),
		),

	/**
	 * A signal crosses an opaque call boundary in a template child (LT-051),
	 * so the lift analysis cannot see where — or whether — it is read. Erring
	 * here rather than emitting a static value is deliberate: a missed lift
	 * is invisible (the server folds it, the markup is correct, and it never
	 * updates), whereas this message is loud.
	 */
	unliftableChild: (
		source: string,
		offset: number | undefined,
		names: string[],
		exprText: string,
	) =>
		error(
			'TSRX017',
			`${names.map(n => `\`${n}\``).join(', ')} ${names.length > 1 ? 'are' : 'is'} passed into a call the compiler cannot see inside, so it cannot tell whether this child is reactive. Wrap it in an explicit thunk: \`{() => ${exprText}}\`.`,
			lineOf(source, offset),
		),

	/**
	 * The retired `&{expr}` lazy-child sigil (LT-052). In TSRX, `&{` and `&[`
	 * introduce lazy DESTRUCTURING patterns in binding position; there is no
	 * `&{}` template-child form. Reactivity is decided by the lift rule
	 * (`reactivity.ts`) now, so the sigil carries no information.
	 */
	retiredLazySigil: (
		source: string,
		offset: number | undefined,
		exprText: string,
	) =>
		error(
			'TSRX018',
			`\`&{…}\` is not a TSRX template child — \`&{\` and \`&[\` introduce lazy destructuring patterns in binding position. Reactivity is now decided by analysis, so drop the sigil: \`{${exprText}}\`.`,
			lineOf(source, offset),
		),

	/**
	 * A string literal naming an exposed or managed prop in child position
	 * (LT-052). This used to mean "watch this prop by name" — but only
	 * because the `&` sigil disambiguated it from ordinary text. Without the
	 * sigil `{'label'}` is indistinguishable from the literal string, so the
	 * prop read must be written explicitly.
	 */
	stringLiteralPropChild: (
		source: string,
		offset: number | undefined,
		prop: string,
	) =>
		error(
			'TSRX019',
			`\`{'${prop}'}\` names a prop but reads as the literal string "${prop}" — the \`&\` sigil that used to distinguish them is gone (LT-052). Write the read explicitly: \`{host.${prop}}\`.`,
			lineOf(source, offset),
		),

	/**
	 * A lazy destructuring pattern (`&{ … }` / `&[ … ]`) in binding position
	 * (LT-052). These are real TSRX grammar, but they defer evaluation to
	 * first read — and Le Truc's server half must evaluate setup eagerly to
	 * produce markup at render time, where there is nothing to defer to.
	 * Unsupported in this host profile rather than silently half-working.
	 */
	lazyDestructuring: (
		source: string,
		offset: number | undefined,
		form: 'object' | 'array',
	) =>
		error(
			'TSRX020',
			`Lazy destructuring (\`&${form === 'object' ? '{ … }' : '[ … ]'}\`) is not supported in the Le Truc profile — server composition evaluates setup eagerly to render markup, so there is no first-read to defer to. Use a plain \`${form === 'object' ? '{ … }' : '[ … ]'}\` pattern.`,
			lineOf(source, offset),
		),
}
