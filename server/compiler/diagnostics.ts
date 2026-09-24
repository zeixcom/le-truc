/**
 * Compile diagnostics for the Le Truc component compiler (ADR 0023).
 *
 * Diagnostics are the compiler's product surface: a wrong rewrite is a wrong
 * component, so every rule that cannot be applied reports a code, a message,
 * and — where the author can act on it — a suggested fix. `severity` decides
 * how the build effect treats a file (see effects/compile.ts): errors fail the
 * build, known milestone gates warn and skip the file.
 *
 * The `DiagnosticCode` union carries two prefixes, split by ownership (ADR
 * 0028 sub-design 1, as amended 2026-09-19): rules the shared machinery emits
 * on both authored surfaces are `LTC###`; the six `TSRX###` codes diagnose
 * `.tsrx` grammar specifically — the React idioms they guard against are
 * `.tsx`'s correct spellings, so those rules cannot be compiler-wide. The
 * number spaces do not overlap and the union stays one type. A new code is
 * `LTC###` unless the rule is specific to `.tsrx` grammar. Full disposition:
 * `VOCABULARY_LEDGER.md` beside this file.
 */

/* === Types === */

export type DiagnosticCode =
	| 'LTC001' // @for over a reactive source that is not a declared createList
	| 'LTC002' // loop variable referenced inside a reactive thunk — hoist it first
	| 'LTC003' // hoisted const not rebindable to a server-rendered attribute
	// ('LTC004' is spent: retired as an emitted code at LT-165 step 5, it
	// survives ONLY as a routing-signal origin — see tier.ts's
	// `RoutingSignalOrigin`, which owns the spelling now)
	| 'LTC005' // construct outside the sanctioned milestone-2 subset
	| 'LTC006' // malformed or unsupported attribute shape
	| 'LTC007' // template structure the compiler cannot address
	| 'LTC008' // source shape violation (root tag, exports, style placement)
	| 'LTC009' // invalid `export const config` extension declaration
	| 'LTC010' // managed form prop used without formAssociated
	| 'LTC011' // composed (PascalCase) element with no resolvable .tsrx/.tsx import
	| 'LTC012' // pass={{ }}/reactive dispatch legality on a custom-element target, incl. per-prop Slot-backedness (LT-158)
	// ('LTC013' is spent: retired as an emitted code at LT-165 step 5 — its
	// two server-evaluation factories became routing signals, the other two
	// split to LTC044/LTC045 in step 1 — and survives ONLY as a
	// routing-signal origin; see tier.ts's `RoutingSignalOrigin`)
	| 'LTC014' // plain (non-.tsrx) import whose bindings are never used anywhere the compiler can place them
	| 'LTC015' // requestContext() called with other than exactly two arguments
	| 'LTC016' // requestContext()'s fallback argument is not server-known
	| 'LTC017' // template child whose reactivity cannot be traced — needs a thunk
	| 'TSRX018' // retired `&{}` lazy-child sigil
	| 'LTC019' // string-literal prop name in child position — write host.<prop>
	| 'TSRX020' // RETIRED (LT-210 pin bump) — @tsrx/core 0.2 dropped lazy destructuring from the grammar, so `&{ … }`/`&[ … ]` no longer parse; the rejection is the parser's own syntax error, surfaced as LTC008. No builder emits this code; the member stays so every spent number is visible in the union (ADR 0028 lifecycle)
	| 'TSRX021' // React `{cond && <jsx/>}` conditional-render idiom in child position
	| 'TSRX022' // React `{cond ? <a/> : <b/>}` conditional-render idiom in child position
	| 'TSRX023' // React `.map()` producing JSX in child position
	| 'TSRX024' // React `return (<>…</>)` render idiom in setup position
	| 'LTC025' // malformed first() element-reference call
	| 'LTC026' // first()/all() selector matches no element, uses unverifiable syntax, or is malformed
	| 'LTC027' // first() selector matches multiple, non-mutually-exclusive elements
	| 'LTC028' // expose() names a member it cannot: managed by formAssociated(), or a reserved word
	| 'LTC029' // a form-associated component's inner control carries a name
	| 'LTC030' // <textarea value={…}> — textarea has no value content attribute
	| 'LTC031' // RETIRED — per-branch addressing replaced it; no builder emits this code; the member stays so every spent number is visible in the union (ADR 0028 lifecycle)
	| 'LTC032' // destructured prop has a default value but its type isn't marked optional
	| 'LTC033' // a static child or server-rendered attribute reads an impure ambient (Date/Intl/Math.random/toLocaleString) — reactive thunks are omitted silently instead (LT-165 step 5)
	| 'LTC034' // severe only (LT-165 step 5): disabled/checked unresolvable on a submittable control of a Static-tier component; non-severe sites are routing signals
	| 'LTC035' // duplicate static id across @try/@catch/@pending arms
	| 'LTC036' // real `@zeix/le-truc` export used without an explicit import (sub-design 16)
	| 'LTC037' // FactoryContext name inside an authored `@zeix/le-truc` import (sub-design 16)
	| 'LTC038' // duplicate static id across compose sites (LT-090)
	| 'LTC039' // Parser-exposed prop whose value is also rendered into an owned site (LT-122)
	| 'LTC040' // required first() whose only match sits in a branch that may not render (LT-123)
	| 'LTC041' // two first() names resolve to the same element (LT-132)
	| 'LTC042' // a static id in a template duplicates once the component is instantiated twice (LT-131)
	// ('LTC043' is spent: retired as an emitted code at LT-165 step 5, it
	// survives ONLY as a routing-signal origin — see tier.ts's
	// `RoutingSignalOrigin`, which owns the spelling now)
	| 'LTC044' // a signal's initializer conditionally chooses between two constructor calls (ADR 0024 sub-design 12 format rule; split from LTC013 by LT-165)
	| 'LTC045' // a collector-requiring helper deferred into a callback, so it throws NoActiveCollectorError at connect (split from LTC013 by LT-165)
	| 'LTC046' // a setup const the value harness cannot evaluate has its value rendered into the markup — no tier can produce the site (LT-165 step 5)
	| 'LTC047' // literal prose in a component that declares `export const i18n` — route it through a message key (LT-173 step 5, ADR 0030 sub-design 4)
	| 'LTC048' // one component tag declared by multiple corpus sources outside a folder-local variant set (dual front end, ADR 0032 sub-design 6; narrowed to the ADR 0039 variant-set rule, LT-283) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC049' // the factory-context parameter destructures a name that is not FactoryContext vocabulary, or is not a destructured object (LT-209) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC050' // the factory-context annotation's surface disagrees with `config.formAssociated` (LT-209) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC051' // a variant set's compiled members disagree on CSS (ADR 0039, LT-283) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC052' // a server-data @for carries a `key` clause, which only a reactive List's reconcile() reads (ADR 0040 s1, LT-286) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC053' // an element tag that is not a static name: a `.tsrx` dynamic `<{expr}>` tag, or a `.tsx` namespaced/member tag the front end does not recognize (LT-213, scope A0) — tier 1 Prevented, statically decidable, no runtime half

export type CompileDiagnostic = {
	code: DiagnosticCode
	severity: 'error' | 'warning'
	message: string
	/** 1-based line in the authored source (either front end), when known. */
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

/**
 * `basic-gauge-label` → `basicGaugeLabelId`: a plausible server-arg name for
 * an id the author has to lift out of the template (LT-131). Only used to
 * make LTC042's fix-it concrete — the author is free to pick another name.
 */
const sanitizeArgName = (id: string): string => {
	const camel = id
		.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) =>
			c ? c.toUpperCase() : '',
		)
		.replace(/^[0-9]+/, '')
	const base = camel === '' ? 'element' : camel
	return /id$/i.test(base) ? base : `${base}Id`
}

const warning = (
	code: DiagnosticCode,
	message: string,
	line?: number,
): CompileDiagnostic =>
	line === undefined
		? { code, severity: 'warning', message }
		: { code, severity: 'warning', message, line }

/**
 * 1-based line for a source offset. Exported since LT-165: the tier census
 * cites the same line the diagnostic did, and one implementation keeps the
 * two agreeing.
 */
export const lineOf = (
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
	// --- @for and hoisted-const rebinding ---
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
			'LTC001',
			`@for over reactive source \`${iterable ?? '?'}\` — only declared createList(…) signals lower (reconcile(), ADR 0017); derived or non-List reactive sources are not supported. File skipped.`,
			lineOf(source, offset),
		),

	/**
	 * A `@for` over server data carries a `key` clause (ADR 0040 s1,
	 * LT-286). Keys identify items across `reconcile()`'s keyed diff — a
	 * reactive-List concern; a server-data loop lowers to `each()`, which
	 * has no key parameter, so the clause was silently collected and
	 * dropped. ADR 0028 tier 1 (Prevented): statically decidable from the
	 * loop's iterable alone, no runtime half exists. Mirrors the `.tsx`
	 * surface's existing `map` arity rejection ("the key clause is a
	 * reactive-List concern").
	 *
	 * Message copy is owned by Tech Writer per ADR 0028's lifecycle
	 * (reviewed 2026-09-24).
	 */
	keyOnServerDataFor: (source: string, offset: number | undefined) =>
		error(
			'LTC052',
			'This `@for` iterates server data but has a `key` clause — only a `@for` over a declared `createList(…)` signal reconciles its items by key, so this key has no effect. Remove the `key` clause, or declare the items with `createList(…)` if they must be keyed.',
			lineOf(source, offset),
		),

	/**
	 * An element whose tag is not a static name (LT-213, owner ruling
	 * 2026-09-24: scope A0). `.tsrx`: `@tsrx/core` parses `<{expr}>…</{expr}>`
	 * into a dynamic-name container that the lowering used to flatten to
	 * `tag: ""` with no diagnostic. `.tsx`: a namespaced (`<truc:element>`)
	 * or member (`<a.b>`) tag the front end does not recognize — `tsc` would
	 * reject the missing `IntrinsicElements` entry, but the build does not
	 * necessarily run `tsc`. ADR 0028 tier 1 (Prevented): statically
	 * decidable from the tag node alone, no runtime half. The recorded
	 * server-known-tag design (TODO LT-213) is built only when a migration
	 * needs it.
	 *
	 * Message copy is owned by Tech Writer per ADR 0028's lifecycle
	 * (reviewed 2026-09-24).
	 */
	unsupportedElementTag: (
		source: string,
		offset: number | undefined,
		spelled: string,
		conditional: string,
	) =>
		error(
			'LTC053',
			`The tag \`<${spelled}>\` is not a static element name — the compiler supports only static tag names, so it cannot make an element from this tag. Choose between static tags with a conditional, for example \`${conditional}\`.`,
			lineOf(source, offset),
		),

	/** Loop variable used inside a reactive thunk — the hoist-first rule. */
	loopVariableInReactiveThunk: (
		source: string,
		offset: number | undefined,
		names: string[],
	) =>
		error(
			'LTC002',
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
			'LTC003',
			`Hoisted const \`${name}\` is referenced by a reactive expression but never rendered as a bare attribute of <${element}>, so the client cannot rebind it. Render it (e.g. \`aria-controls={${name}}\` or a \`data-\` attribute) or stop referencing it reactively.`,
			lineOf(source, offset),
		),

	// --- subset, attribute shapes, addressing, source structure ---
	/** Anything outside the sanctioned milestone-2 construct set. */
	unsupported: (source: string, offset: number | undefined, what: string) =>
		error(
			'LTC005',
			`${what} is outside the sanctioned milestone-2 subset of ADR 0023. Supported: text/attribute/class reactive bindings, event attributes, refs, @for over server data, hoisted-const rebinding, harvest rules.`,
			lineOf(source, offset),
		),

	/** Attribute shape the classifier does not accept. */
	invalidAttribute: (
		source: string,
		offset: number | undefined,
		what: string,
	) => error('LTC006', what, lineOf(source, offset)),

	/** Element the generated client cannot address deterministically. */
	unaddressableElement: (
		source: string,
		offset: number | undefined,
		what: string,
	) => error('LTC007', what, lineOf(source, offset)),

	/**
	 * Source-level structure violations. `invalidSource` takes the family's
	 * `(source, offset, what)` shape like its siblings (LT-223): sites that
	 * have a node in scope pass its offset so the report carries a line;
	 * file-level shapes (parse failures, a missing component function) pass
	 * `undefined` and stay line-less.
	 */
	invalidSource: (source: string, offset: number | undefined, what: string) =>
		error('LTC008', what, lineOf(source, offset)),

	// --- config, managed form props, composition, pass legality ---
	/** Invalid `export const config` declaration (ADR 0023 sub-design 8). */
	invalidConfig: (source: string, offset: number | undefined, what: string) =>
		error('LTC009', what, lineOf(source, offset)),

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
			'LTC010',
			`\`{host.${prop}}\` reads a managed form prop — it is watchable only when formAssociated() leads the extensions. Declare \`export const config = { formAssociated: true }\` or expose a prop of that name.`,
			lineOf(source, offset),
		),

	/**
	 * A capitalized JSX tag with no matching component import (`'….tsrx'` or
	 * `'….tsx'`; ADR 0023 sub-design 10) — composition resolves by import,
	 * never falls back to raw custom-element treatment.
	 */
	unresolvedComposedComponent: (
		source: string,
		offset: number | undefined,
		name: string,
	) =>
		error(
			'LTC011',
			`\`<${name}>\` has no matching \`import { ${name} }\` of a \`.tsrx\` or \`.tsx\` module — composed (capitalized) tags must import the component they compose (ADR 0023 sub-design 10). A lowercase dashed tag addresses a raw custom element instead.`,
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
			'LTC011',
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
			'LTC011',
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
			'LTC012',
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
			'LTC012',
			`pass={{ … }} on <${tag}> — its target must be a registry-known custom element (ADR 0023 sub-design 10); native elements use reactive attribute bindings instead. At connect this is \`InvalidCustomElementError\`.`,
			lineOf(source, offset),
		),

	/**
	 * `pass={{ prop }}` naming a prop the target component does not
	 * `expose()` at all (LT-158, ADR 0028 sub-design 6). The runtime check
	 * is `!(prop in target)` — weaker, because an inherited `HTMLElement`
	 * member passes it and then fails the Slot check one line later. The
	 * compiler asks the stronger and more useful question: `expose()` is
	 * the complete list of a Le Truc component's reactive props, so a name
	 * absent from it can never be Slot-backed however the DOM is shaped.
	 *
	 * Only raised for a target whose entry is in the registry — a
	 * hand-authored or foreign custom element keeps the Tier 2 backstop.
	 */
	passPropNotExposed: (
		source: string,
		offset: number | undefined,
		tag: string,
		prop: string,
		exposed: string[],
	) =>
		error(
			'LTC012',
			`pass={{ ${prop}: … }} targets <${tag}>, which does not expose \`${prop}\` — its reactive props are ${exposed.length ? exposed.map(p => `\`${p}\``).join(', ') : '(none)'}. Add \`${prop}\` to that component's \`expose({ … })\`, or pass one of the props it does declare. At connect this is \`InvalidPassPropertyError\`.`,
			lineOf(source, offset),
		),

	/**
	 * `pass={{ prop }}` naming a prop the target exposes READ-ONLY — ADR
	 * 0011's own motivating example, and the residual ADR 0028 sub-design 6
	 * asked the registry to close. `pass()` swaps the target's backing
	 * SIGNAL, so it needs a Slot ([ADR 0004]); `#setAccessor` only builds
	 * one for a mutable initializer. A computed (`expose({ x: sig.get })`,
	 * `expose({ x: () => … })`) and a `defineMethod()` producer are both
	 * defined with a plain getter instead, so the swap has nothing to
	 * attach to.
	 *
	 * This is the row that makes containment (LT-155) safe to rely on: the
	 * runtime check still fires and is now contained, so without the
	 * compiler carrying it the author would learn about a dead binding from
	 * a console line rather than a build failure.
	 */
	passPropNotSlotBacked: (
		source: string,
		offset: number | undefined,
		tag: string,
		prop: string,
		kind: 'computed' | 'method',
	) =>
		error(
			'LTC012',
			kind === 'method'
				? `pass={{ ${prop}: … }} targets <${tag}>, whose \`${prop}\` is a \`defineMethod()\` producer, not a reactive property — it is installed as a plain member and has no Slot to swap. Call it (\`el.${prop}()\`) from an event handler instead of passing to it. At connect this is \`InvalidPassPropertyError\`.`
				: `pass={{ ${prop}: … }} targets <${tag}>, whose \`${prop}\` is exposed READ-ONLY — a computed initializer (\`sig.get\` or \`() => …\`) is defined with a getter, not a Slot, so there is no backing signal for pass() to swap (ADR 0004). Expose \`${prop}\` from a mutable initializer on <${tag}> (a value, a Parser, or a \`{ get, set }\` descriptor) if it is meant to be driven from outside; otherwise drive it from <${tag}>'s own state. At connect this is \`InvalidPassPropertyError\`.`,
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
			'LTC012',
			`pass={{ … }} on <${component}> needs a \`first()\` reference addressing it — a composed element's server args aren't guaranteed to render as DOM attributes, so it can't be auto-addressed the way native/raw custom elements are. Give the compose site a static class and address it by the tag it renders, e.g. \`const el = first('child-tag.discriminator', 'required')\` (LT-127).`,
			lineOf(source, offset),
		),

	// --- imports, requestContext, children, ref spellings ---
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
			'LTC014',
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
			'LTC015',
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
			'LTC016',
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
			'LTC017',
			`${names.map(n => `\`${n}\``).join(', ')} ${names.length > 1 ? 'are' : 'is'} passed into a call the compiler cannot see inside, so it cannot tell whether this child is reactive. Wrap it in an explicit thunk: \`{() => ${exprText}}\`.`,
			lineOf(source, offset),
		),

	/**
	 * The retired `&{expr}` lazy-child sigil (LT-052). The `&` sigil has no
	 * template-child meaning — under the 0.2 pin it introduces nothing at all
	 * (lazy destructuring left the grammar), and reactivity is decided by the
	 * lift rule (`reactivity.ts`), so the sigil carries no information.
	 */
	retiredLazySigil: (
		source: string,
		offset: number | undefined,
		exprText: string,
	) =>
		error(
			'TSRX018',
			`\`&{…}\` is not a TSRX template child — the \`&\` sigil carries no meaning here (lazy destructuring left the TSRX 0.2 grammar). Reactivity is decided by analysis, so drop the sigil: \`{${exprText}}\`.`,
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
			'LTC019',
			`\`{'${prop}'}\` names a prop but reads as the literal string "${prop}" — the \`&\` sigil that used to distinguish them is gone (LT-052). Write the read explicitly: \`{host.${prop}}\`.`,
			lineOf(source, offset),
		),

	// --- React near-miss idioms ---
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

	// --- first()/all() selectors ---
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
			'LTC025',
			`\`const ${name} = first(…)\` must be called with one or two string literals — a selector alone for an optional reference (\`first('span.badge')\`, yields \`undefined\` when absent), or a selector plus a required-reason string (\`first('input', 'required')\`, throws with that reason) — so the compiler can resolve the reference structurally at compile time.`,
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
			'LTC026',
			`\`first('${selector}', …)\` (bound to \`${name}\`) matches no element in this component's template, or uses selector syntax this compiler cannot verify structurally — supported: a tag plus any combination of \`.class\`, \`#id\`, \`[attr]\`/\`[attr="value"]\`, and comma-separated lists. Adjust the selector to match a real, statically-addressable element. A required reference that survives to runtime with no match is \`MissingElementError\`.`,
			lineOf(source, offset),
		),

	/**
	 * A `first()`/`all()` selector that is not merely unverifiable but
	 * MALFORMED (LT-157b, ADR 0028 sub-design 5) — the half of
	 * `InvalidSelectorError` a compiler can decide outright, as opposed to
	 * `firstSelectorNotFound`'s "matches nothing here, or I cannot tell."
	 * Shares LTC026 because the author's fix is the same one sentence:
	 * correct the selector.
	 *
	 * `all()` matters more than `first()` here. A `first()` selector is
	 * compile-time-only — the emitted query is the compiler's own
	 * structurally-proven selector — but `all()`'s selector is emitted
	 * VERBATIM into the client, where `createElementsMemo` probes it with
	 * an eager `querySelector` precisely because a `SyntaxError` raised
	 * later inside the MutationObserver callback would be swallowed and
	 * leave the memo permanently stale.
	 */
	malformedSelector: (
		source: string,
		offset: number | undefined,
		helper: 'first' | 'all',
		selector: string,
		reason: string,
	) =>
		error(
			'LTC026',
			`\`${helper}('${selector}', …)\` is not a valid CSS selector — ${reason}. \`querySelector\` would throw a SyntaxError on it (InvalidSelectorError at connect); fix the selector.`,
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
			'LTC027',
			`\`first('${selector}', …)\` (bound to \`${name}\`) matches ${count} elements in this component's template, and they are not all mutually-exclusive branches of the same @if — give the target a distinguishing \`class\`/\`id\`/\`data-*\` and name it in the selector. On a COMPOSED (PascalCase) element the attribute goes on the COMPOSE SITE, not inside the child (LT-127): \`<FormSpinbutton class="lightness" />\` → \`first('form-spinbutton.lightness', …)\`.`,
			lineOf(source, offset),
		),

	// --- formAssociated surface ---
	/**
	 * `expose()` names a reserved word or `Object` builtin (LT-157a, ADR
	 * 0028 sub-design 5) — `src/types.ts`'s `RESERVED_WORDS_LIST`. The
	 * runtime throws `InvalidPropertyNameError` for these, and the throw is
	 * deliberately ordered BEFORE `#initSignals`'s `prop in this` guard:
	 * every reserved name is an inherited own-property of `Object`, so the
	 * guard would otherwise skip the colliding initializer silently. That
	 * ordering is what protects the prototype chain — not the throw
	 * escaping — which is why containing the throw (LT-155) costs nothing
	 * and why this rule is the one that has to carry the signal.
	 *
	 * Shares LTC028 with `managedFormMemberShadowed`: both say "this
	 * `expose()` key is not available," and both are fixed by renaming the
	 * prop.
	 */
	reservedExposeName: (
		source: string,
		offset: number | undefined,
		member: string,
	) =>
		error(
			'LTC028',
			`\`expose({ ${member}: … })\` names \`${member}\`, a reserved word or Object builtin — it cannot be a reactive property, because defining an accessor for it would shadow a member every object inherits. Rename the prop (e.g. \`${member}Value\`). At connect this is \`InvalidPropertyNameError\`.`,
			lineOf(source, offset),
		),

	/**
	 * `expose()` names a member `formAssociated()`/`formAssociatedCheckbox()`
	 * installs on the prototype (LT-058, extending the LTC010 managed-prop
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
			'LTC028',
			`\`expose({ ${member}: … })\` shadows the \`${member}\` member ${extension}() installs on the prototype — it is managed automatically (form-participation host contract) and cannot be exposed. Remove it, or rename the reactive property if you need something similar under a different name. At connect this is \`InvalidPropertyNameError\`.`,
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
			'LTC029',
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
			'LTC030',
			'`<textarea value={…}>` has no effect — `value` is not a real HTML attribute on `<textarea>` (the browser ignores it) and the pre-hydration control renders empty. Set the initial value as text content instead: `<textarea>{value}</textarea>`.',
			lineOf(source, offset),
		),

	// --- binding defaults, impure ambients, loaded-attribute defaults ---
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
			'LTC032',
			`Prop \`${name}\` has a default value but its type isn't marked optional — mark it \`${name}?:\` in the props type, or the default is unreachable (omitting \`${name}\` is a type error for any external caller before the default ever applies).`,
			lineOf(source, offset),
		),

	/**
	 * A `static` template child (CHECKLIST §4) — one with no signal
	 * dependency at all, so it renders exactly once, server-side, forever —
	 * reads an impure ambient. There is no `watch()` to ever correct this:
	 * the build machine's one clock/locale/timezone/RNG reading is baked into
	 * the page permanently. Hard error, not a warning — CHECKLIST §4 calls
	 * this out as the worst outcome ("folding to the build machine's
	 * reading"). The REACTIVE counterpart omits the expression instead and
	 * stays silent (LT-165 step 5): there the client's first binding pass
	 * corrects it, so it is unresolvability (ADR 0029 s1 limb b), not an
	 * author error — while a static child has no correction at all.
	 */
	impureStaticChild: (source: string, offset: number | undefined) =>
		error(
			'LTC033',
			"This child reads an ambient value (`Date`/`Intl`, `Math.random()`, or a locale/timezone method) with no signal dependency, so it renders exactly once, server-side, at build time, forever — the build machine's clock/locale/timezone/RNG reading gets baked into the page permanently, with no client-side correction. Wrap it in a signal (e.g. `createCell(...)` set from a client-only effect) so it can be a reactive child instead, or move the computation out of the template entirely.",
			lineOf(source, offset),
		),

	/**
	 * The attribute counterpart of {@link impureStaticChild} (LT-075). A
	 * `kind: 'server'` attribute (`<div title={Date.now()}>`) is rendered
	 * once into the initial HTML and never bound client-side, so it carries
	 * exactly the hazard the child form does — CHECKLIST §4's worst outcome,
	 * folding to the build machine's own reading with no correction. The
	 * REACTIVE thunk form (`title={() => Date.now()}`) is omitted from the
	 * initial HTML instead and draws no diagnostic (LT-165 step 5): the
	 * client's first binding pass supplies the value.
	 */
	impureStaticAttribute: (
		source: string,
		offset: number | undefined,
		attrName: string,
	) =>
		error(
			'LTC033',
			`Attribute \`${attrName}\` reads an ambient value (\`Date\`/\`Intl\`, \`Math.random()\`, or a locale/timezone method) with no signal dependency, so it is rendered exactly once, server-side, at build time, forever — the build machine's clock/locale/timezone/RNG reading gets baked into the page permanently, with no client-side correction. Make it a reactive thunk (\`${attrName}={() => …}\`, which the client's first binding pass sets) or take the value as a server arg so the caller owns it.`,
			lineOf(source, offset),
		),

	/**
	 * A semantically-loaded attribute (CHECKLIST §5 — `hidden`, `disabled`,
	 * `checked`, `selected`, `aria-expanded`) has no server-renderable
	 * initial value AND no server phase can supply one: `emit-server.ts`'s
	 * reactive-attribute case pushes NOTHING for this shape — the attribute
	 * is simply absent from the initial HTML, which means visible/
	 * enabled-and-submittable/unchecked/deselected/collapsed, the more
	 * dangerous of each pair, regardless of what the author meant.
	 *
	 * Reclassified by LT-165 step 5 (ADR 0029 s5): the general case left the
	 * diagnostic channel for the tier census — an unresolvable site is a
	 * routing fact about the harness, not an author error. What SURVIVES is
	 * the severe form (LT-062/LT-085): `disabled`/`checked` on a real
	 * submittable form control (`input`/`select`/`textarea`/`button` inside a
	 * `formAssociated`/`formAssociatedCheckbox` component), where "enabled
	 * and submittable" or "unchecked" regardless of author intent is a
	 * correctness bug (the control can submit, or fail to, against the
	 * author's actual intent), not just a cosmetic pre-hydration flash.
	 *
	 * Scoped per-EXPRESSION, not per-component (LT-184, refining ADR 0029
	 * s5): the caller (`analysis/effects.ts`) pushes it only for a severe
	 * site whose OWN resolution is `none` — unresolvable in every tier, so
	 * the value is omitted no matter how the component routes. A severe site
	 * the realm can answer stays silent (the realm renders the value, so the
	 * diagnostic would be noise), including on a component routed Simulated
	 * by some other signal. Non-severe sites never reach this builder at all.
	 */
	unsafeLoadedAttributeDefault: (
		source: string,
		offset: number | undefined,
		name: string,
	) => {
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
		return error(
			'LTC034',
			`\`${name}\` has no server-renderable initial value here, and no server phase can resolve this value in any tier — so \`${name}\` is silently OMITTED from the initial HTML. Omission is not neutral for \`${name}\`: it renders the ${stateWord} state regardless of what this expression would actually evaluate to once connected. This is a real submittable form control, so the wrong default is a correctness bug — the control can submit, or fail to, regardless of what the author intended — not just a cosmetic pre-hydration flash. Trace the value to a server-known prop or signal so it can render an initial value, or accept the pre-hydration flash explicitly by giving this element a static/server-rendered default for \`${name}\`.`,
			lineOf(source, offset),
		)
	},

	// --- duplicate ids, import hygiene, duplicated channels ---
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
			'LTC035',
			`id="${id}" appears in both ${firstArm} and ${secondArm} — all arms of a \`@try\`/\`@catch\`/\`@pending\` boundary render into the initial HTML at once (non-active arms are hidden, not removed), so this is two elements sharing an id in the same document simultaneously. Give each arm's element a distinct id.`,
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
			'LTC036',
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
			'LTC037',
			`\`${name}\` is FactoryContext vocabulary — ambient in this host profile, not a '@zeix/le-truc' export. Remove it from the import (drop the whole line if it's the only named import left).`,
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
			'LTC038',
			`id="${id}" appears on ${count} composed elements — each compose site's id is materialized on that instance's host element, so this is ${count} elements sharing an id in the same document. Give each site a distinct id, or address the instances with a static class instead.`,
			lineOf(source, offset),
		),

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
	 *
	 * `formManaged` (LT-141) branches the fix-it for `value`/`checked` on a
	 * `formAssociated()`/`formAssociatedCheckbox()` host that renders the
	 * prop into an owned site but does NOT carry the corresponding host
	 * attribute: there, the ordinary advice ("drop the attribute") is
	 * backwards, because the host attribute IS the reset baseline
	 * (`defaultValue`/`defaultChecked`) the extension's `formResetCallback`
	 * needs. The exemption in `reportDuplicatedChannels` only fires when
	 * that attribute IS present — this message covers the case where it
	 * should be present and isn't.
	 */
	duplicatedPropChannel: (
		source: string,
		offset: number | undefined,
		prop: string,
		parser: string,
		formManaged: boolean,
	) =>
		warning(
			'LTC039',
			formManaged
				? `\`${prop}\` is exposed through a Parser (\`${parser}\`, which reads the host attribute) and is ALSO rendered into this component's own markup from the \`${prop}\` arg — the value ships twice, and when the host attribute is absent the Parser's fallback wins and this site's server-rendered content is overwritten on the first binding pass. On a form-associated host \`${prop}\` is the reset baseline (\`default${prop === 'checked' ? 'Checked' : 'Value'}\`) — render the host attribute too (\`<… ${prop}={${prop}}>\`) rather than dropping it; do not stop rendering the value here either, since the baseline attribute alone gives no initial DOM state for the control to mirror.`
				: `\`${prop}\` is exposed through a Parser (\`${parser}\`, which reads the host attribute) and is ALSO rendered into this component's own markup from the \`${prop}\` arg — the value ships twice, and when the host attribute is absent the Parser's fallback wins and this site's server-rendered content is overwritten on the first binding pass. Harvest it from the site instead (\`expose({ ${prop}: <ref read> })\`, HOST_PROFILE § data account) and drop the attribute, or stop rendering the value here.`,
			lineOf(source, offset),
		),

	// --- reference identity and per-instance ids ---
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
			'LTC040',
			`\`const ${name} = first('${selector}', …)\` is declared REQUIRED, but its only match in this template sits inside a branch that may not render — the client addresses it with an existence guard either way, so the required-reason string is never thrown. Drop it (\`first('${selector}')\`) to say optional outright. For a template-owning component the compiler controls the markup, so a required-reason only earns its keep on a selector that may match markup this component did not itself render.`,
			lineOf(source, offset),
		),

	/**
	 * Two `first()` declarations resolve to the SAME element (LT-132).
	 * Silent until now: the ref IR is a list, but every consumer reads it
	 * with `.find(a => a.kind === 'ref')`, so only the first name ever
	 * became a query — the generated client then declared one const and
	 * referenced the other, which surfaced as a tsc error on GENERATED
	 * code with nothing pointing back at the `.tsrx` line that caused it.
	 * Two names for one element is a mistake, not a shorthand: an alias
	 * would work mechanically (`addQuery` dedups by selector+cardinality)
	 * but would leave the author believing they had addressed two things.
	 */
	firstSelectorDuplicate: (
		source: string,
		offset: number | undefined,
		name: string,
		selector: string,
		existing: string,
	) =>
		error(
			'LTC041',
			`\`first('${selector}', …)\` (bound to \`${name}\`) resolves to the same element as \`${existing}\` — two names for one element. Only one of them would become a query and the other would be undefined at runtime. Use \`${existing}\` in both places, or give the two elements distinguishing \`class\`/\`id\`/\`data-*\` attributes and address them separately.`,
			lineOf(source, offset),
		),

	/**
	 * A STATIC `id` attribute in a template (LT-131). An `id` is unique per
	 * DOCUMENT, but a template is a per-INSTANCE thing: the moment a page
	 * places the component twice, the constant renders twice and every
	 * `aria-labelledby`/`aria-describedby`/`<label for>` pointing at it
	 * resolves to the FIRST instance — invalid HTML and, when it is an
	 * `aria-*` wiring, a real accessibility defect.
	 *
	 * A warning, not an error: a single-instance component is legitimate,
	 * and the compiler cannot know how many times a page will place it. The
	 * fix is ownership, not generation — the compiler inventing an id would
	 * make the server render non-deterministic and give the client nothing
	 * stable to re-derive, so the id belongs to whoever instantiates the
	 * component (HOST_PROFILE § data account, bullet 3).
	 */
	staticIdInTemplate: (
		source: string,
		offset: number | undefined,
		tag: string,
		id: string,
	) =>
		warning(
			'LTC042',
			`\`<${tag} id="${id}">\` is a constant \`id\` in a template — it duplicates the moment a page places this component twice, and any \`aria-labelledby\`/\`aria-describedby\`/\`<label for>\` pointing at it resolves to the FIRST instance. Take the id as a server arg with a default instead (\`{ ${sanitizeArgName(id)} = '${id}' }\`) and render it as \`id={${sanitizeArgName(id)}}\`, so whoever instantiates the component owns the value; wire every reference from that same arg.`,
			lineOf(source, offset),
		),

	// --- signal initializer shapes ---
	/**
	 * A setup const's initializer conditionally chooses between two signal-
	 * constructor calls (`cond ? deriveCell(...) : createCell(...)`) — the
	 * initializer must be a SINGLE, unconditional call to a recognized
	 * constructor; conditional logic belongs inside the callback, not as a
	 * choice between constructors (ADR 0023 sub-design 12).
	 *
	 * Own code since LT-165 (was `LTC013`). It is a FORMAT rule, not a
	 * server-evaluation guard: harvest planning needs one shape to plan for,
	 * and no tier supersedes that — so unlike its former code-mates it stays
	 * an error rather than becoming a routing signal (ADR 0029 s5).
	 */
	conditionalSignalConstructor: (
		source: string,
		offset: number | undefined,
		name: string,
	) =>
		error(
			'LTC044',
			`\`${name}\`'s initializer conditionally chooses between two signal-constructor calls — a signal must be a single, unconditional call to a recognized constructor (createCell/createState/deriveCell/…). Move the condition inside the callback instead (e.g. \`deriveCell(() => cond ? a : b)\`).`,
			lineOf(source, offset),
		),

	/**
	 * A collector-requiring helper (`watch`/`on`/`pass`/`provideContexts`/
	 * `each`/`reconcile`) called from inside a nested function in a
	 * client-only setup statement (LT-157d, ADR 0028 sub-design 5). Those
	 * helpers do not create their effect — they push a descriptor into the
	 * ambient collector (`src/internal.ts`'s `pushDescriptor`), which is
	 * active only while the factory itself is running (ADR 0018). A call
	 * deferred into a callback therefore runs after the factory returned,
	 * with no collector to push into, and throws `NoActiveCollectorError`.
	 *
	 * The compiler cannot EMIT this shape — every generated `watch`/`on`/
	 * `pass` call sits at the top level of the factory — so the whole rule
	 * exists for hand-authored client-setup statements, which are exactly
	 * the half ADR 0028 says the compiler owes ([M15] keeps the runtime
	 * check as the backstop for no-build components it never sees).
	 *
	 * Deliberately silent on a call nested inside `reconcile()`/`each()`'s
	 * own `bindItem` callback: that one runs INSIDE a per-item collector,
	 * which is the whole point of those helpers.
	 *
	 * Own code since LT-165 (was `LTC013`). It is a CLIENT-side bug —
	 * `NoActiveCollectorError` at connect — so it is tier-independent and
	 * stays an error; retiring it with the server-evaluation guards would
	 * have deleted a real check (ADR 0029 s5).
	 */
	deferredCollectorCall: (
		source: string,
		offset: number | undefined,
		helper: string,
	) =>
		error(
			'LTC045',
			`\`${helper}(…)\` is called from inside a callback — it collects an effect descriptor into the factory's ambient collector, which is gone by the time a deferred callback runs, so this throws NoActiveCollectorError at connect (contained per ADR 0028, so the effect silently never activates). Call \`${helper}(…)\` directly in setup and make the callback's condition part of the effect instead (e.g. \`watch(() => cond ? … : …, sink)\`).`,
			lineOf(source, offset),
		),

	/**
	 * A setup const the value harness cannot evaluate — its initializer reads
	 * a client-only primitive (`first`/`all`/`watch`/…), a `first()`-bound
	 * ref, or `host`/`internals` — has its VALUE rendered into the markup
	 * (LT-165 step 5). This is the narrow residue of the retired `LTC013`/
	 * `LTC043` refusals, and it stays an error where they did not: an
	 * UNrendered client-only const routes the component Simulated and the
	 * realm runs it for real, but a RENDERED one asks the server to splice a
	 * value no phase can produce — the fold cannot run the read, the realm
	 * would have to serialize the site, and the Static tier omits the
	 * expression with no client binding to correct it (a static splice is
	 * never re-set at connect). Same structural class as `impureStaticChild`:
	 * not a flash, a permanent wrong-or-empty site.
	 *
	 * Deliberately not fired for a FUNCTION initializer: a setup helper is
	 * dead code server-side (defined, never called), so its free names never
	 * evaluate — and a const reached only INDIRECTLY (this const's
	 * initializer reads another const that reads a ref) is not caught either;
	 * both surface as a source-mapped tsc failure on the generated module
	 * instead (the LT-136 posture, tracked with LT-093/LT-135).
	 */
	renderedClientOnlyConst: (
		source: string,
		offset: number | undefined,
		name: string,
		badNames: string[],
	) =>
		error(
			'LTC046',
			`\`${name}\`'s value is rendered into this component's markup, but its initializer reads ${badNames.map(n => `\`${n}\``).join(', ')} — client-only name(s) the server cannot evaluate in ANY tier, so the site would render broken or stay permanently empty (no client binding ever corrects a static splice). Render the site from a server arg or signal instead, or make the site reactive (wrap the read in a thunk, e.g. \`title={() => …}\`) so the client's first binding pass supplies the value.`,
			lineOf(source, offset),
		),

	// --- i18n and the tier-1 prevented surface ---
	/**
	 * Literal prose inside a component that declares `export const i18n`
	 * (LT-173 step 5, ADR 0030 sub-design 4).
	 *
	 * A warning, and a genuine one: unlike a missing translation (the
	 * translator's work, reported in the build's translation census) an
	 * untranslated literal is author-fixable, so it belongs in the
	 * compile-warning channel and must converge to zero (ADR 0029
	 * sub-design 6's baseline). Fires on template text nodes containing two
	 * or more adjacent letters — a single-letter fragment (pluralize's `s`
	 * suffix spans) is page data, not prose. Per ADR 0028 this is Tier 1
	 * (Prevented): the string ships untranslatable unless the author routes
	 * it through the catalog.
	 *
	 * Message copy is owned by Tech Writer per ADR 0028's lifecycle; this
	 * draft is the LT-173 handoff.
	 */
	untranslatedLiteral: (
		source: string,
		offset: number | undefined,
		sample: string,
	) =>
		warning(
			'LTC047',
			`Literal prose \`${sample}\` is not routed through the catalog — this component declares \`export const i18n\`, so a reader-facing string written directly in the template can never be translated. Declare a key with this string as its source-locale value in \`export const i18n\` and render \`{t.<key>}\` here.`,
			lineOf(source, offset),
		),

	/**
	 * One component tag declared by MULTIPLE corpus sources that are not a
	 * folder-local variant set (LT-202, ADR 0032 sub-design 6; narrowed by
	 * ADR 0039 / LT-283): the corpus scan globs `.tsrx` AND `.tsx` into one
	 * registry, and a tag with two authored owners would make the registry,
	 * the generated module names, and every `pass()`/compose resolution
	 * ambiguous. A corpus folder MAY carry a variant set — at most one
	 * authored source per surface sharing one base name in one directory —
	 * which compiles every member and serves the selected surface; any other
	 * collision (two same-surface sources, or same-tag sources in different
	 * folders) still fails. ADR 0028 tier 1 (Prevented) — statically
	 * decidable at corpus-compile time from the tag map alone, no runtime
	 * half exists. Error severity: the build fails naming every declaring
	 * file, and all files are dropped from the generated output.
	 *
	 * Message copy is owned by Tech Writer per ADR 0028's lifecycle.
	 * Corpus-level: fires once per involved file, no source offset.
	 */
	duplicateTag: (tag: string, sources: ReadonlyArray<string>) =>
		error(
			'LTC048',
			`Component tag \`${tag}\` is declared by more than one corpus source, and the sources are not one variant set: ${sources.join(', ')} — a variant set is at most one source per surface (\`.tsrx\`, \`.tsx\`) with one base name in one directory. Delete the extra same-surface source, move the spellings into one folder under one base name, or rename the tag of one source.`,
		),

	/**
	 * The compiled members of a variant set disagree on CSS (ADR 0039,
	 * LT-283). A variant set serves ONE surface's stylesheet under the
	 * canonical name, so a drift means the unserved member renders with CSS
	 * that was never compiled for it — the parity contract (byte-identical
	 * CSS across surfaces) is what makes the set one component rather than
	 * two. ADR 0028 tier 1 (Prevented) — a byte comparison over the members'
	 * compiled CSS, statically decidable, no runtime half. Error severity:
	 * the build fails naming every member, and none of the set's artifacts
	 * are written (mirroring LTC048's both-dropped semantics).
	 *
	 * Message copy is owned by Tech Writer per ADR 0028's lifecycle.
	 * Corpus-level: fires once per involved
	 * file, no source offset.
	 */
	variantCssDrift: (tag: string, sources: ReadonlyArray<string>) =>
		error(
			'LTC051',
			`Variant set \`${tag}\` compiles to different CSS across its members: ${sources.join(', ')} — the build writes one stylesheet for the whole set, so it wrote no artifact of the set. Make the styles of every member byte-identical: copy the styles of the served member into the others.`,
		),

	/**
	 * The authored second (factory-context) parameter is not a destructured
	 * object of FactoryContext vocabulary (LT-209). The generated client
	 * destructures the same names from ITS factory parameter, so a name the
	 * context does not carry would be a "Cannot find name" in the generated
	 * module — and a silent `any` anywhere the ambient stood in before.
	 * ADR 0028 tier 1 (Prevented): statically decidable from the parameter
	 * list alone, no runtime half exists. Error severity: the shape cannot
	 * be lowered honestly.
	 *
	 * Message copy is owned by Tech Writer per ADR 0028's lifecycle; this
	 * draft is the LT-209 handoff.
	 */
	badFactoryContextParam: (
		source: string,
		offset: number | undefined,
		bad: ReadonlyArray<string>,
	) =>
		error(
			'LTC049',
			`The factory context parameter destructures ${bad.map(b => `\`${b}\``).join(', ')}, which ${bad.length === 1 ? 'is' : 'are'} not FactoryContext vocabulary — destructure only \`host\`, \`first\`, \`all\`, \`expose\`, \`watch\`, \`on\`, \`pass\`, \`internals\`, \`requestContext\`, and \`provideContexts\`, e.g. \`, { host, expose }: FactoryContext<MyProps>\`.`,
		),

	/**
	 * The factory-context annotation's surface disagrees with the
	 * component's own `config.formAssociated` (LT-209): a form-associated
	 * component annotating plain `FactoryContext` types `host` without the
	 * managed form members it really has (`setCustomValidity(…)` would not
	 * type-check), and a plain component annotating `FormFactoryContext`
	 * claims members the element does not carry. ADR 0028 tier 1
	 * (Prevented): both facts are AST-visible, no runtime half exists.
	 *
	 * Message copy is owned by Tech Writer per ADR 0028's lifecycle; this
	 * draft is the LT-209 handoff.
	 */
	formContextMismatch: (annotated: 'FactoryContext' | 'FormFactoryContext') =>
		error(
			'LTC050',
			annotated === 'FactoryContext'
				? `This component sets \`config.formAssociated\` but annotates its factory context as plain \`FactoryContext\` — \`host\` is missing the managed form members the element really carries. Annotate \`FormFactoryContext<MyProps>\` instead (its \`host\` is \`FormAssociatedElement & MyProps\`).`
				: `This component annotates its factory context as \`FormFactoryContext\` but is not form-associated (no \`config.formAssociated\`) — \`host\` would claim form members the element does not have. Annotate \`FactoryContext<MyProps>\` instead, or configure \`config.formAssociated\` if the component really participates in forms.`,
		),
}
