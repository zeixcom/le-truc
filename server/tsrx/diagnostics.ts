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
	| 'TSRX021' // React `{cond && <jsx/>}` conditional-render idiom in child position
	| 'TSRX022' // React `{cond ? <a/> : <b/>}` conditional-render idiom in child position
	| 'TSRX023' // React `.map()` producing JSX in child position
	| 'TSRX024' // React `return (<>…</>)` render idiom in setup position
	| 'TSRX025' // malformed first() element-reference call
	| 'TSRX026' // first() selector matches no element, or uses unverifiable syntax
	| 'TSRX027' // first() selector matches multiple, non-mutually-exclusive elements
	| 'TSRX028' // expose() names a member managed by formAssociated()/formAssociatedCheckbox()
	| 'TSRX029' // a form-associated component's inner control carries a name
	| 'TSRX030' // <textarea value={…}> — textarea has no value content attribute
	| 'TSRX031' // client-construct attribute present on one @if/@else branch root but not the other
	| 'TSRX032' // destructured prop has a default value but its type isn't marked optional
	| 'TSRX033' // a reactive expression that would otherwise fold server-side reads an impure ambient (Date/Intl/Math.random/toLocaleString)
	| 'TSRX034' // a semantically-loaded attribute (hidden/disabled/checked/selected/aria-expanded) has no server-renderable value
	| 'TSRX035' // duplicate static id across @try/@catch/@pending arms
	| 'TSRX036' // real `@zeix/le-truc` export used without an explicit import (sub-design 16)
	| 'TSRX037' // FactoryContext name inside an authored `@zeix/le-truc` import (sub-design 16)
	| 'TSRX038' // duplicate static id across compose sites (LT-090)
	| 'TSRX039' // Parser-exposed prop whose value is also rendered into an owned site (LT-122)
	| 'TSRX040' // required first() whose only match sits in a branch that may not render (LT-123)

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

	/**
	 * A prop that is Parser-exposed AND rendered into the component's
	 * own markup from a same-named server arg (LT-122). Two seeding
	 * stories for one value: the Parser reads the HOST ATTRIBUTE at
	 * connect, the site carries the same value as CONTENT. The page
	 * therefore has to carry it twice, and if the host attribute is
	 * absent the Parser's fallback wins and the first binding pass
	 * OVERWRITES the text the server rendered.
	 *
	 * A warning rather than an error (owner decision, 2026-08-30):
	 * harvesting from the DOM is the preferred contract, but an
	 * attribute-driven prop whose site merely displays it is a
	 * legitimate shape the corpus has not yet argued either way.
	 */
	duplicatedPropChannel: (
		source: string,
		offset: number | undefined,
		prop: string,
		parser: string,
	) =>
		warning(
			'TSRX039',
			`\`${prop}\` is exposed through a Parser (\`${parser}\`, which reads the host attribute) and is ALSO rendered into this component's own markup from the \`${prop}\` arg — the value ships twice, and when the host attribute is absent the Parser's fallback wins and this site's server-rendered content is overwritten on the first binding pass. Harvest it from the site instead (\`expose({ ${prop}: <ref read> })\`, TSRX-HOST-PROFILE § data account) and drop the attribute, or stop rendering the value here.`,
			lineOf(source, offset),
		),

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
			`pass={{ … }} on <${component}> needs a \`first()\` reference addressing it — a composed element's server args aren't guaranteed to render as DOM attributes, so it can't be auto-addressed the way native/raw custom elements are. Give the compose site a static class and address it by the tag it renders, e.g. \`const el = first('child-tag.discriminator', 'required')\` (LT-127).`,
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

	/**
	 * `{cond && <jsx/>}` (LT-054): React's short-circuit conditional-render
	 * idiom. TSRX has no implicit "falsy renders nothing" rule — this renders
	 * literally, stringifying a boolean ANDed with a JSX node — so it must be
	 * rewritten to `@if`, not merely warned about.
	 */
	reactLogicalJsx: (
		source: string,
		offset: number | undefined,
		condText: string,
		exprText: string,
	) =>
		error(
			'TSRX021',
			`\`{${exprText}}\` is the React \`&&\` conditional-render idiom — TSRX has no implicit falsy-renders-nothing rule, so this renders literally instead of conditionally. Use \`@if (${condText}) { … }\` instead.`,
			lineOf(source, offset),
		),

	/**
	 * `{cond ? <a/> : <b/>}` (LT-054): React's ternary conditional-render
	 * idiom. Same failure mode as `reactLogicalJsx` — the chosen branch
	 * stringifies instead of rendering.
	 */
	reactTernaryJsx: (
		source: string,
		offset: number | undefined,
		condText: string,
		exprText: string,
	) =>
		error(
			'TSRX022',
			`\`{${exprText}}\` is the React ternary conditional-render idiom — TSRX renders it literally (the chosen branch stringified), not conditionally. Use \`@if (${condText}) { … } @else { … }\` instead.`,
			lineOf(source, offset),
		),

	/**
	 * `.map()` producing JSX in child position (LT-054): React's list-render
	 * idiom. TSRX's loop construct is `@for`; `.map()` over server data
	 * renders literally (`Array.prototype.toString()` over the JSX nodes).
	 */
	reactMapJsx: (
		source: string,
		offset: number | undefined,
		itemName: string,
		arrayText: string,
		exprText: string,
	) =>
		error(
			'TSRX023',
			`\`{${exprText}}\` is the React \`.map()\` list-render idiom — TSRX renders it literally (the array stringified), not as a loop. Use \`@for (const ${itemName} of ${arrayText}) { … }\` instead.`,
			lineOf(source, offset),
		),

	/**
	 * `return (<>…</>)` in setup position (LT-054): React's component-return
	 * idiom. TSRX's output is the setup block's trailing JSX expression
	 * itself — there is no `return` in the sanctioned subset.
	 */
	reactReturnJsx: (source: string, offset: number | undefined) =>
		error(
			'TSRX024',
			"`return (…)` is the React component-return idiom — TSRX's output is the setup block's trailing JSX expression itself, not a return value. Drop `return`, keep the `<>…</>` as a bare expression.",
			lineOf(source, offset),
		),

	/**
	 * `first(…)` (LT-055) called with anything other than one or two
	 * string literals. Two (selector + a human required-reason) is the
	 * REQUIRED form, verified structurally against the component's own
	 * template; one (a bare selector) is the OPTIONAL form (LT-123),
	 * which may match markup the component did not itself render and
	 * yields `undefined` instead of throwing.
	 */
	invalidFirstCall: (
		source: string,
		offset: number | undefined,
		name: string,
	) =>
		error(
			'TSRX025',
			`\`const ${name} = first(…)\` must be called with one or two string literals — a selector alone for an optional reference (\`first('span.badge')\`, yields \`undefined\` when absent), or a selector plus a required-reason string (\`first('input', 'required')\`, throws with that reason) — so the compiler can resolve the reference structurally at compile time.`,
			lineOf(source, offset),
		),

	/**
	 * A REQUIRED `first(selector, reason)` whose only match sits
	 * inside a branch that may not render (LT-123) — the reason
	 * can never be thrown, because the analysis addresses such an
	 * element with a non-throwing query under a presence guard.
	 */
	deadRequiredReason: (
		source: string,
		offset: number | undefined,
		name: string,
		selector: string,
	) =>
		warning(
			'TSRX040',
			`\`const ${name} = first('${selector}', …)\` is declared REQUIRED, but its only match in this template sits inside a branch that may not render — the client addresses it with an existence guard either way, so the required-reason string is never thrown. Drop it (\`first('${selector}')\`) to say optional outright. For a template-owning component the compiler controls the markup, so a required-reason only earns its keep on a selector that may match markup this component did not itself render.`,
			lineOf(source, offset),
		),

	/**
	 * `first()`'s selector matches no element in the template, or uses syntax
	 * outside the structurally-verifiable subset (LT-055): a bare tag plus
	 * any combination of `.class`, `#id`, `[attr]`/`[attr="value"]`, and
	 * comma-separated lists. Both cases are reported together — from the
	 * author's side, "no match" and "can't tell" call for the same fix.
	 */
	firstSelectorNotFound: (
		source: string,
		offset: number | undefined,
		name: string,
		selector: string,
	) =>
		error(
			'TSRX026',
			`\`first('${selector}', …)\` (bound to \`${name}\`) matches no element in this component's template, or uses selector syntax this compiler cannot verify structurally — supported: a tag plus any combination of \`.class\`, \`#id\`, \`[attr]\`/\`[attr="value"]\`, and comma-separated lists. Adjust the selector to match a real, statically-addressable element.`,
			lineOf(source, offset),
		),

	/**
	 * `first()`'s selector matches more than one element that aren't all
	 * direct branch roots of the same `@if` (LT-055) — the compiler cannot
	 * tell which one the author means. A selector spanning an `@if`/`@else`
	 * with different element types per branch (`first('input, textarea',
	 * …)`) is the one multi-match shape that IS allowed.
	 */
	firstSelectorAmbiguous: (
		source: string,
		offset: number | undefined,
		name: string,
		selector: string,
		count: number,
	) =>
		error(
			'TSRX027',
			`\`first('${selector}', …)\` (bound to \`${name}\`) matches ${count} elements in this component's template, and they are not all mutually-exclusive branches of the same @if — add a distinguishing \`.class\`/\`#id\`/\`[attr]\` to the selector.`,
			lineOf(source, offset),
		),

	/**
	 * `expose()` names a member `formAssociated()`/`formAssociatedCheckbox()`
	 * installs on the prototype (LT-058, extending the TSRX010 managed-prop
	 * family): silently shadows the managed member at the JS level — the
	 * runtime already throws `InvalidPropertyNameError` for it
	 * (`component.ts`'s `reservedMembers` check), but only once the
	 * component actually connects. Caught here at compile time instead, so
	 * the failure surfaces before the component ever ships.
	 */
	managedFormMemberShadowed: (
		source: string,
		offset: number | undefined,
		member: string,
		extension: 'formAssociated' | 'formAssociatedCheckbox',
	) =>
		error(
			'TSRX028',
			`\`expose({ ${member}: … })\` shadows the \`${member}\` member ${extension}() installs on the prototype — it is managed automatically (form-participation host contract) and cannot be exposed. Remove it, or rename the reactive property if you need something similar under a different name.`,
			lineOf(source, offset),
		),

	/**
	 * A form-associated component's inner native control carries a `name`
	 * (LT-059): the control stays out of native form submission only
	 * because it is unnamed — the host submits via `setFormValue` instead.
	 * A named inner control submits the field TWICE: once via
	 * `setFormValue`, once natively. The markup looks entirely reasonable
	 * and the failure is server-side (a duplicate form field) and invisible
	 * in the browser, so this is a compiler error, not a doc note.
	 */
	formControlHasName: (
		source: string,
		offset: number | undefined,
		tag: string,
	) =>
		error(
			'TSRX029',
			`<${tag}> is a descendant of a formAssociated() component and carries a \`name\` — it would submit natively AND via the host's \`setFormValue\`, submitting the field twice. Remove \`name\` from <${tag}>; the host element is the sole form participant.`,
			lineOf(source, offset),
		),

	/**
	 * `<textarea value={…}>` (CHECKLIST §10): `value` is not a real HTML
	 * attribute on `<textarea>` — the browser silently ignores it. The
	 * initial value must be the element's text content instead. Flags every
	 * attribute-value form (static, server, or reactive-thunk) uniformly,
	 * since all three render into the same invalid server attribute.
	 */
	textareaValueAttribute: (source: string, offset: number | undefined) =>
		error(
			'TSRX030',
			'`<textarea value={…}>` has no effect — `value` is not a real HTML attribute on `<textarea>` (the browser ignores it) and the pre-hydration control renders empty. Set the initial value as text content instead: `<textarea>{value}</textarea>`.',
			lineOf(source, offset),
		),

	/**
	 * A destructured prop has a default value (`foo = 'x'`) but its type
	 * annotation doesn't mark the field optional (`foo: string`, not `foo?:
	 * string`) — CHECKLIST §10's last gotcha. TypeScript treats the
	 * annotation as authoritative for external callers (composing the
	 * component, or a hand-authored `.tsx` caller), so the default is
	 * unreachable from outside: omitting the prop is a type error before the
	 * default ever gets a chance to apply.
	 */
	defaultOnRequiredProp: (
		source: string,
		offset: number | undefined,
		name: string,
	) =>
		error(
			'TSRX032',
			`Prop \`${name}\` has a default value but its type isn't marked optional — mark it \`${name}?:\` in the props type, or the default is unreachable (omitting \`${name}\` is a type error for any external caller before the default ever applies).`,
			lineOf(source, offset),
		),

	/**
	 * A reactive expression's free names are all server-known — it would
	 * otherwise fold to a server-rendered initial value — but it also reads
	 * an impure ambient (`Date`/`Intl`, `Math.random()`, `toLocaleString()`/
	 * `getTimezoneOffset()`) whose actual input is the BUILD MACHINE's own
	 * clock/locale/timezone/RNG, not any server arg (CHECKLIST §4). Folding
	 * would bake that one build-time reading into the page permanently — for
	 * SSG specifically, stale by however long the page sits before being
	 * served. `isServerEvaluable` (evaluability.ts) already refuses to fold
	 * this (omitted server-side, same as any non-portable thunk, corrected
	 * by the client's first binding pass) — a WARNING, not an error, since
	 * the omission is safe; this just explains why the initial HTML won't
	 * show a value here, so it doesn't read as an unrelated bug.
	 */
	impureServerFold: (
		source: string,
		offset: number | undefined,
		attrName: string | null,
	) =>
		warning(
			'TSRX033',
			`${attrName ? `Reactive attribute \`${attrName}\`` : 'This reactive expression'} reads an ambient value (\`Date\`/\`Intl\`, \`Math.random()\`, or a locale/timezone method) whose real input is the BUILD MACHINE's own clock/locale/timezone/RNG, not a server arg — folding it would bake one build-time reading into the page permanently. Refusing to fold: the ${attrName ? 'attribute is' : 'child is'} omitted from the initial HTML and set by the client's first binding pass instead.`,
			lineOf(source, offset),
		),

	/**
	 * A `static` template child (CHECKLIST §4) — one with no signal
	 * dependency at all, so it renders exactly once, server-side, forever —
	 * reads an impure ambient. Unlike {@link impureServerFold}'s reactive
	 * case, there is no `watch()` to ever correct this: the build machine's
	 * one clock/locale/timezone/RNG reading is baked into the page
	 * permanently. Hard error, not a warning — CHECKLIST §4 calls this out
	 * as the worst outcome ("folding to the build machine's reading").
	 */
	impureStaticChild: (source: string, offset: number | undefined) =>
		error(
			'TSRX033',
			"This child reads an ambient value (`Date`/`Intl`, `Math.random()`, or a locale/timezone method) with no signal dependency, so it renders exactly once, server-side, at build time, forever — the build machine's clock/locale/timezone/RNG reading gets baked into the page permanently, with no client-side correction. Wrap it in a signal (e.g. `createCell(...)` set from a client-only effect) so it can be a reactive child instead, or move the computation out of the template entirely.",
			lineOf(source, offset),
		),

	/**
	 * A semantically-loaded attribute (CHECKLIST §5 — `hidden`, `disabled`,
	 * `checked`, `selected`, `aria-expanded`) has no server-renderable
	 * initial value: it's not a host-prop mirror or a derived `host.<prop>`
	 * fold (`hostDerivedFold`, evaluability.ts — both always render from the
	 * root's own server arg(s)) and its thunk isn't otherwise server-
	 * evaluable (a sensor read, or any other dependency the server can't
	 * resolve). `emit-server.ts`'s reactive-attribute case pushes NOTHING for
	 * this shape — the attribute is simply absent from the initial HTML,
	 * which means visible/enabled-and-submittable/unchecked/deselected/
	 * collapsed, the more dangerous of each pair, regardless of what the
	 * author meant.
	 *
	 * WARNING by default: some sensor-driven shapes have no server value at
	 * all and are a documented, deliberately accepted flash-risk tradeoff
	 * (ADR 0023, `basic-pluralize.tsrx`'s history before LT-085 widened the
	 * fold rule to cover its own `host.count` comparisons) — hard-erroring
	 * unconditionally would treat every unfoldable case as equally severe.
	 * `severe` (LT-062/LT-085 decision) escalates to ERROR specifically for
	 * `disabled`/`checked` on a real submittable form control (`input`/
	 * `select`/`textarea`/`button` inside a `formAssociated`/
	 * `formAssociatedCheckbox` component): there, "enabled and submittable"
	 * or "unchecked" regardless of author intent is a correctness bug (the
	 * control can submit, or fail to, against the author's actual intent),
	 * not just a cosmetic pre-hydration flash.
	 */
	unsafeLoadedAttributeDefault: (
		source: string,
		offset: number | undefined,
		name: string,
		severe: boolean,
	) => {
		const build = severe ? error : warning
		const stateWord =
			name === 'hidden'
				? 'visible'
				: name === 'disabled'
					? 'enabled AND submittable'
					: name === 'checked'
						? 'unchecked'
						: name === 'selected'
							? 'deselected'
							: 'collapsed'
		const correctnessNote = severe
			? ` This is a real submittable form control, so the wrong default is a correctness bug — the control can submit, or fail to, regardless of what the author intended — not just a cosmetic pre-hydration flash.`
			: ''
		return build(
			'TSRX034',
			`\`${name}\` has no server-renderable initial value here — the server can't resolve this thunk (a sensor, or any dependency outside props/signals), so \`${name}\` is silently OMITTED from the initial HTML. Omission is not neutral for \`${name}\`: it renders the ${stateWord} state regardless of what this expression would actually evaluate to once connected.${correctnessNote} Trace the value to a server-known prop or signal so it can render an initial value, or accept the pre-hydration flash explicitly by giving this element a static/server-rendered default for \`${name}\`.`,
			lineOf(source, offset),
		)
	},

	/**
	 * A literal `id` is duplicated across `@try`/`@catch`/`@pending` arms
	 * (CHECKLIST §8). All three arms render into the initial HTML
	 * simultaneously — two `hidden`, not removed — so a shared `id` is two
	 * elements sharing an id in the SAME document at once, real regardless
	 * of whether `@pending` is present (a plain `@try`/`@catch` render-time
	 * boundary has exactly the same two-arms-present-at-once shape).
	 */
	duplicateIdAcrossArms: (
		source: string,
		offset: number | undefined,
		id: string,
		firstArm: string,
		secondArm: string,
	) =>
		error(
			'TSRX035',
			`id="${id}" appears in both ${firstArm} and ${secondArm} — all arms of a \`@try\`/\`@catch\`/\`@pending\` boundary render into the initial HTML at once (non-active arms are hidden, not removed), so this is two elements sharing an id in the same document simultaneously. Give each arm's element a distinct id.`,
			lineOf(source, offset),
		),

	/**
	 * The same static `id` appears on more than one composed element
	 * (LT-090). A compose site's `id` materializes on that instance's host
	 * element in the initial HTML (`composeHostAttrs`) — duplicated, that is
	 * two elements sharing an id in the SAME document: invalid HTML, and
	 * id-based addressing (`first('#x')`, label `for`) resolves to at most
	 * one of them, never reliably the right one.
	 */
	duplicateComposeId: (
		source: string,
		offset: number | undefined,
		id: string,
		count: number,
	) =>
		error(
			'TSRX038',
			`id="${id}" appears on ${count} composed elements — each compose site's id is materialized on that instance's host element, so this is ${count} elements sharing an id in the same document. Give each site a distinct id, or address the instances with a static class instead.`,
			lineOf(source, offset),
		),

	/**
	 * A real `@zeix/le-truc` export (`createCell`, `deriveCell`, a parser,
	 * `defineMethod`, …) is used in authored code without a matching
	 * `import { … } from '@zeix/le-truc'` (ADR 0024 sub-design 16). Real
	 * exports are true module exports — authored sources stay valid
	 * TypeScript by construction, which is exactly what the import line
	 * declares. FactoryContext vocabulary (`expose`, `host`, `first`, …) is
	 * ambient and NEVER needs an import.
	 */
	missingRealExportImport: (
		source: string,
		offset: number | undefined,
		name: string,
	) =>
		error(
			'TSRX036',
			`\`${name}\` is a real '@zeix/le-truc' export used here but never imported — add \`import { ${name} } from '@zeix/le-truc'\` (FactoryContext helpers are ambient and need no import).`,
			lineOf(source, offset),
		),

	/**
	 * A FactoryContext member (`expose`, `first`, `all`, `on`, `pass`,
	 * `watch`, `host`, `internals`, `requestContext`, `provideContexts`) is
	 * named in an authored `import { … } from '@zeix/le-truc'` line (ADR
	 * 0024 sub-design 16). These are NOT package exports — the factory
	 * parameter they arrive on is compiler-generated, so the import line is
	 * a false declaration a future working language service would flag, and
	 * re-emitting it would break the generated module.
	 */
	contextNameInImport: (
		source: string,
		offset: number | undefined,
		name: string,
	) =>
		error(
			'TSRX037',
			`\`${name}\` is FactoryContext vocabulary — ambient in this host profile, not a '@zeix/le-truc' export. Remove it from the import (drop the whole line if it's the only named import left).`,
			lineOf(source, offset),
		),
}
