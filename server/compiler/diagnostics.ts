/**
 * Compile diagnostics for the Le Truc component compiler (ADR 0024).
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

import type { SourceRange } from './ir'
import type { SurfaceWording } from './surface'

/* === Types === */

export type DiagnosticCode =
	| 'LTC001' // @for over a reactive source that is not a declared createList
	| 'LTC002' // loop variable referenced inside a reactive thunk — hoist it first
	| 'LTC003' // hoisted const not rebindable to a server-rendered attribute
	// ('LTC004' is spent: retired as an emitted code at LT-165 step 5, it
	// survives ONLY as a routing-signal origin — see tier.ts's
	// `RoutingSignalOrigin`, which owns the spelling now)
	| 'LTC005' // construct outside the supported subset
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
	| 'LTC033' // a static child or server-rendered attribute reads an impure ambient (Date/Intl/Math.random/crypto RNG/toLocaleString), and so do a server-data loop's items (LT-326) — reactive thunks are omitted silently instead (LT-165 step 5)
	| 'LTC034' // severe only (LT-165 step 5): disabled/checked unresolvable on a submittable control of a Static-tier component; non-severe sites are routing signals
	// ('LTC035' is spent: retired at LT-275 — template-cloned arms keep every
	// non-winning arm out of the document (ADR 0037 s4), so a literal id
	// repeated across arms no longer collides. No builder emits this code;
	// the member stays so every spent number is visible in the union (ADR
	// 0028 lifecycle))
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
	| 'LTC054' // a position the server render evaluates reads page context outside the declared ambient set, or the reserved `i18n` record is destructured for a member outside it (ADR 0034 s4, LT-258) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC055' // an `export const i18n` source pattern is not a supported ICU MessageFormat 1 pattern, or a `t.<key>` site disagrees with its pattern's arguments: missing/extra/non-literal arguments, an argument message read without a call, an argument-less message called (ADR 0030 s4, LT-250) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC056' // an authored `<script>` element in a component template, whatever its `type` — the page owns script loading (LT-358 rider) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC061' // an authored `<template>` element in a component template — the compiler owns template extraction, and the selector proof cannot see inside one (LT-383) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC062' // a reactive switch (one whose discriminant reads a signal) has a `@case`/`case` value that is not a literal, or two cases share an arm key (ADR 0037 s2, LT-274) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC063' // a reactive condition inside a reactive list's reconcile() container (ADR 0037 s5, LT-274) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC064' // the component's stylesheet does not parse (ADR 0033 s9, LT-268) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC065' // a stylesheet declaration names a property the CSS dictionary does not know, or a value outside the property's grammar (ADR 0033 s9, LT-394) — tier 2 Contained: the dictionary (mdn-data, via css-tree) lags the platform, so a finding is evidence, not proof; the sheet ships as authored
	| 'LTC066' // a rule in the component's stylesheet is led by the component's own tag — shadow-root form styles the host through `:host` (ADR 0033 s6, LT-304) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC067' // `::slotted()` in a component stylesheet — slotted content is a shadow-DOM construct, and compiled components are light DOM (ADR 0033 s6, LT-304) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC068' // `:host-context()` in a component stylesheet — removed from the CSS spec, matched by no browser (ADR 0033 s6, LT-304) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC069' // `:global` in a form other than the two whole-rule forms — nested, prefixed, trailing, leading-ancestor, mid-selector, or declarations directly in a bare block (ADR 0033 s6a, LT-304) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC070' // `:host` directly followed by a qualifier (`:host.x`, `:host:hover`, `:host[attr]`) — matches nothing in a shadow root; the qualifier belongs in the arguments (ADR 0033 s6, LT-304) — tier 1 Prevented, statically decidable, no runtime half
	| 'LTC071' // a stylesheet selector descends past a boundary tag (`child-tag .x`, `child-tag > .x`) — its subject is a composed child's content, which the scope always excludes (ADR 0033 s6, LT-399) — tier 1 Prevented, statically decidable, no runtime half

/**
 * A range in the file the author wrote (ADR 0044 s1–s2): `start` and `end`
 * are 0-based character offsets (UTF-16 code units, `end` exclusive) — the
 * convention of the estree `start`/`end` every compiler stage walks and of
 * `SourceSpan`. `file` is the path the caller handed the compiler.
 */
export type DiagnosticLocation = {
	file: string
	start: number
	end: number
}

/** One text replacement a fix applies: `location`'s range becomes `text`. */
export type DiagnosticEdit = {
	location: DiagnosticLocation
	text: string
}

/**
 * A repair that is safe to apply without author judgement (ADR 0044 s1).
 * A rule with two equally valid repairs names both in its message and
 * carries no fix.
 */
export type DiagnosticFix = {
	description: string
	edits: DiagnosticEdit[]
}

/**
 * The published diagnostic record (ADR 0044 s1, s5): adding an optional
 * field is a minor; removing or retyping one is a major.
 */
export type CompileDiagnostic = {
	code: DiagnosticCode
	severity: 'error' | 'warning'
	message: string
	/**
	 * The offending construct. A producer with no construct in scope (a
	 * file-level shape) reports the nearest enclosing range — the whole
	 * file — rather than none (ADR 0044 s2).
	 */
	location: DiagnosticLocation
	/** Further locations the message refers to; empty when there are none. */
	related: DiagnosticLocation[]
	fix?: DiagnosticFix
}

/**
 * What a producer hands a factory for the offending construct: any AST
 * node (its `start`/`end`), an explicit range, or nothing (the whole
 * file). Internal.
 */
export type Site =
	| { start?: number | undefined; end?: number | undefined }
	| null
	| undefined

/**
 * A diagnostic as the stages produce it, with ranges local to the file
 * being compiled (internal). `locate()` turns it into the published
 * `CompileDiagnostic` at the compile shell, which knows the file name.
 */
export type LocalDiagnostic = {
	code: DiagnosticCode
	severity: 'error' | 'warning'
	message: string
	range: SourceRange
	related?: SourceRange[]
	fix?: {
		description: string
		edits: { range: SourceRange; text: string }[]
	}
}

/* === Internal Functions === */

const error = (
	code: DiagnosticCode,
	message: string,
	range: SourceRange,
): LocalDiagnostic => ({ code, severity: 'error', message, range })

/** A corpus-level error: the caller names the file and the related ones. */
const corpusError = (
	code: DiagnosticCode,
	message: string,
	location: DiagnosticLocation,
	related: DiagnosticLocation[],
): CompileDiagnostic => ({
	code,
	severity: 'error',
	message,
	location,
	related,
})

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

/** `a`, `b` and `c` — each item in backticks, for a closed list in copy. */
const codeList = (items: Iterable<string>): string => {
	const quoted = [...items].map(item => `\`${item}\``)
	return quoted.length < 2
		? quoted.join('')
		: `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1)}`
}

const warning = (
	code: DiagnosticCode,
	message: string,
	range: SourceRange,
): LocalDiagnostic => ({ code, severity: 'warning', message, range })

/**
 * 1-based line for a source offset — the terminal views print a location's
 * `start` as a line (corpus build report, tier census), and one
 * implementation keeps them agreeing.
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

/**
 * The range a factory reports for `at` in `source`: the node's own
 * `start`/`end`; a zero-width range where only `start` is known; the whole
 * file when nothing in range is known — the nearest enclosing span, never
 * none (ADR 0044 s2).
 */
export const rangeOf = (source: string, at: Site): SourceRange => {
	const start = at?.start
	if (start === undefined || start < 0 || start > source.length)
		return { start: 0, end: source.length }
	const end = at?.end
	return {
		start,
		end: end === undefined || end < start || end > source.length ? start : end,
	}
}

/** A whole file's range — corpus-level rules have no construct inside it. */
export const wholeFile = (
	file: string,
	source: string,
): DiagnosticLocation => ({
	file,
	start: 0,
	end: source.length,
})

/**
 * Publish a stage's diagnostic against `file` (ADR 0044 s1): the compile
 * shells call this once, on the way out.
 */
export const locate = (
	diagnostic: LocalDiagnostic,
	file: string,
): CompileDiagnostic => {
	const at = (range: SourceRange): DiagnosticLocation => ({ file, ...range })
	const located: CompileDiagnostic = {
		code: diagnostic.code,
		severity: diagnostic.severity,
		message: diagnostic.message,
		location: at(diagnostic.range),
		related: (diagnostic.related ?? []).map(at),
	}
	if (diagnostic.fix)
		located.fix = {
			description: diagnostic.fix.description,
			edits: diagnostic.fix.edits.map(edit => ({
				location: at(edit.range),
				text: edit.text,
			})),
		}
	return located
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
		at: Site,
		iterable: string,
		wording: SurfaceWording,
	) =>
		warning(
			'LTC001',
			`${wording.loop} over reactive source \`${iterable}\` — only declared createList(…) signals lower (reconcile(), ADR 0017); derived or non-List reactive sources are not supported. File skipped.`,
			rangeOf(source, at),
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
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-09-24).
	 */
	keyOnServerDataFor: (source: string, at: Site) =>
		error(
			'LTC052',
			'This `@for` iterates server data but has a `key` clause — only a `@for` over a declared `createList(…)` signal reconciles its items by key, so this key has no effect. Remove the `key` clause, or declare the items with `createList(…)` if they must be keyed.',
			rangeOf(source, at),
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
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-09-24).
	 */
	unsupportedElementTag: (
		source: string,
		at: Site,
		spelled: string,
		conditional: string,
	) =>
		error(
			'LTC053',
			`The tag \`<${spelled}>\` is not a static element name — the compiler makes elements from static tag names only. To choose a tag at render time, choose between static tags with a conditional, for example \`${conditional}\`.`,
			rangeOf(source, at),
		),

	/**
	 * A boundary in a loop body (LT-213 follow-up; `.tsrx` parity LT-358a).
	 * The root of a loop body is the element the client addresses each item
	 * through, so it must be an element — and a boundary in the body's
	 * statement position has no element to attach to either. `.tsx`: the
	 * check runs in `lowerFor` before `lowerElement` would report the
	 * `<truc:try>` tag as not a static name, so it fires for the root case.
	 * `.tsrx`: an `@try` statement anywhere at the body's statement level —
	 * `outputOf` accepts an element only, so every body-level `@try` takes
	 * this rule, root-boundary and beside-an-element-output alike (the
	 * reviewed wording covers both). Without it the `.tsrx` case fell to the
	 * generic "statement other than the output element" LTC005, whose fix
	 * ("move the statement into setup") is wrong for a boundary. Same code
	 * both surfaces: the rule and its rationale are surface-independent;
	 * only the spelled constructs differ (`wording.boundary`,
	 * `wording.loop`).
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-359 — worded for both trigger positions).
	 */
	boundaryAsLoopRoot: (source: string, at: Site, wording: SurfaceWording) =>
		error(
			'LTC053',
			`A ${wording.boundary} cannot sit directly in a ${wording.loop} body — the body's root must be an element, because the client addresses each item through it. Wrap the boundary in an element inside the ${wording.loop} body, or move it out of the ${wording.loop} body.`,
			rangeOf(source, at),
		),

	/**
	 * An authored `<script>` element in a component template (LT-358 rider,
	 * owner ruling 2026-10-01). Today such an element passes verbatim into
	 * served HTML and no compiler check names it — but a component template
	 * renders static markup plus component behavior, and script loading
	 * belongs to the page that places the component. Every `<script>` is
	 * refused, whatever its `type` (`module`, `importmap`, a data type, an
	 * empty classic script): the hazard is the same and the fix — move the
	 * loading to the page, the work to the factory — does not depend on it.
	 * ADR 0028 tier 1 (Prevented): statically decidable from the tag name
	 * alone, no runtime half. Raised in `lowerElement` (shared), so both
	 * surfaces refuse it identically.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-359 — the LT-358 first draft, finalized).
	 */
	scriptElementInTemplate: (source: string, at: Site) =>
		error(
			'LTC056',
			"A `<script>` element in a component template — scripts are refused, whatever their `type`: the page owns script loading, and a component template is static markup plus component behavior. Move the script to the page that places this component, or do its work in the component's setup (in `watch()` or an `on()` handler).",
			rangeOf(source, at),
		),

	/**
	 * An authored `<template>` element in a component template (LT-383,
	 * LT-379 follow-up). The compiler owns template extraction: a reactive
	 * list's item template and template-cloned arms (ADR 0037) are emitted
	 * `<template>`s, and an authored one collides with them. The selector
	 * proof also cannot see inside one — css-select's HTML-mode traversal
	 * skips `<template>` content (ADR 0045) — so a uniqueness answer over a
	 * template carrying one would be silently wrong. Every authored
	 * `<template>` is refused. ADR 0028 tier 1 (Prevented): statically
	 * decidable from the tag name alone, no runtime half. Raised in
	 * `lowerElement` (shared), so both surfaces refuse it identically.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-359 — the LT-383 first draft, finalized).
	 */
	templateElementInTemplate: (source: string, at: Site) =>
		error(
			'LTC061',
			"A `<template>` element in a component template — the compiler emits the `<template>`s a component needs (a reactive list's item template, its conditional arms), and an authored one would collide with them. Render the markup directly, or let a reactive list or condition produce the repeated or switched content.",
			rangeOf(source, at),
		),

	/**
	 * A reactive switch keys its arms by their case values (ADR 0037 s2:
	 * `case:` + the literal's JSON), so a case value must be a literal the
	 * server emit and the generated client can name identically at compile
	 * time, and no two cases may share a key (`1` and `1.0` do; `'1'` and
	 * `1` do not). A dynamic value has no fallback. Channel: compiler
	 * (shared lowering, both surfaces). ADR 0028 tier 1 (Prevented):
	 * statically decidable, no runtime half.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-275 — the LT-274 first draft, finalized).
	 */
	dynamicCaseValue: (
		source: string,
		at: Site,
		caseText: string,
		wording: SurfaceWording,
		duplicate = false,
	) =>
		error(
			'LTC062',
			duplicate
				? `The ${wording.caseLabel} value \`${caseText}\` names the same arm as an earlier one in a switch that reads a signal. Its arms switch on the client by a key derived from each value, so every value must name a distinct arm — remove or merge the duplicate.`
				: `The ${wording.caseLabel} value \`${caseText}\` is not a literal in a switch that reads a signal. Its arms switch on the client by a key derived from each value at compile time — write each value as a string, number, boolean or \`null\` literal.`,
			rangeOf(source, at),
		),

	/**
	 * A reactive condition inside a reactive list's `reconcile()` container
	 * (ADR 0037 s5): the container is self-cleaning — its first run removes
	 * every unkeyed child — so the arm templates and the live arm would be
	 * swept until the unkeyed-sibling rule exists (LT-185's follow-up).
	 * Channel: compiler (shared lowering, both surfaces). ADR 0028 tier 1
	 * (Prevented): statically decidable, no runtime half.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-275 — the LT-274 first draft, finalized).
	 */
	reactiveConditionInReconcileContainer: (
		source: string,
		at: Site,
		wording: SurfaceWording,
	) =>
		error(
			'LTC063',
			`${wording.reactiveConditional} inside the container of a reactive-list ${wording.loop}. The list owns that container's children and removes everything it did not place, the arm and its templates included — move the condition out of the container, or wrap the loop in an element of its own.`,
			rangeOf(source, at),
		),

	/**
	 * The partial-readiness invariant (ADR 0034 sub-design 4, LT-258): a
	 * position the server render evaluates — a static child or attribute, a
	 * condition, a setup const, a folded reactive thunk — reads page context
	 * (`document`, `window`, `navigator`, …; the list is
	 * `PAGE_CONTEXT_GLOBALS` in fold-inputs.ts), directly or through a setup
	 * helper. The fold would bake the build's answer into the markup, and a
	 * template emitter has no variable to carry it to a backend. ADR 0028
	 * tier 1 (Prevented): statically decidable, no runtime half. `where`
	 * names the position in lower case (`attribute \`title\` on <c-el>`);
	 * `ambients` is `PAGE_AMBIENTS`, passed in so the copy follows the set.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-09-25).
	 */
	foldReadsPageContext: (
		source: string,
		at: Site,
		where: string,
		reads: readonly string[],
		ambients: Iterable<string>,
	) =>
		error(
			'LTC054',
			`The server evaluates ${where} at build time, but it reads ${codeList(reads)}, which is page context. Server-rendered HTML can depend only on the component's own args and on ${codeList(ambients)} from the \`i18n\` record — a template backend has no variable for page context. Pass the value in as an arg, or read it in the factory (in \`watch()\` or an \`on()\` handler), where it runs in the browser.`,
			rangeOf(source, at),
		),

	/**
	 * The params-side half of LTC054: the reserved `i18n` record is
	 * destructured for a member outside the declared ambient set, or through
	 * a rest element. `member` is null for a rest element or a computed key.
	 * `ambients` is `PAGE_AMBIENTS`, passed in so the copy follows the set.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-09-25).
	 */
	undeclaredPageAmbient: (
		source: string,
		at: Site,
		member: string | null,
		ambients: Iterable<string>,
	) =>
		error(
			'LTC054',
			`${member === null ? 'This destructuring takes an undeclared member' : `\`${member}\` is not a member`} of the reserved \`i18n\` record. The record carries only ${codeList(ambients)} — the page values that server-rendered HTML can depend on besides the component's own args. ${member === null ? 'Destructure the members you need by name' : `Destructure one of these members, or declare \`${member}\` as an arg`}.`,
			rangeOf(source, at),
		),

	/**
	 * Loop variable used inside a reactive thunk — the hoist-first rule.
	 * Worded surface-neutrally ("loop variables"): the rule is the same for
	 * a `@for` and a `.map()` callback (LT-233).
	 */
	loopVariableInReactiveThunk: (source: string, at: Site, names: string[]) =>
		error(
			'LTC002',
			`Reactive expressions must not reference loop variables directly (${names.map(n => `\`${n}\``).join(', ')}). Hoist the derived value into a const first (e.g. \`const pid = panelId(tab.id)\`) so the client can rebind it to a server-rendered attribute.`,
			rangeOf(source, at),
		),

	/** Hoisted const referenced reactively but never rendered as a bare attribute. */
	constNotRebindable: (
		source: string,
		at: Site,
		name: string,
		element: string,
	) =>
		error(
			'LTC003',
			`Hoisted const \`${name}\` is referenced by a reactive expression but never rendered as a bare attribute of <${element}>, so the client cannot rebind it. Render it (e.g. \`aria-controls={${name}}\` or a \`data-\` attribute) or stop referencing it reactively.`,
			rangeOf(source, at),
		),

	// --- subset, attribute shapes, addressing, source structure ---
	/**
	 * A construct outside the supported subset of ADR 0024. `what` names the
	 * construct as the subject of the sentence; `fix`, when the site knows
	 * it, is the imperative the author acts on (LT-300).
	 */
	unsupported: (source: string, at: Site, what: string, fix?: string) =>
		error(
			'LTC005',
			`${what} is outside the supported subset (ADR 0024).${fix ? ` ${fix}` : ''}`,
			rangeOf(source, at),
		),

	/**
	 * LTC005's server-only face (LT-347–LT-349): a position the generated
	 * client emits authored code into reads a name that module does not
	 * bind, so the read throws a ReferenceError at connect. `subject` names
	 * the position and opens the sentence (`Reactive text on <span>`,
	 * `` Event handler `onClick` ``). The names arrive split by binding
	 * class, because each class has its own fix: `server` — a component
	 * parameter (`t` and `lang` included) or a server-data loop binding;
	 * `module` — a module-level declaration, which neither generated module
	 * copies; `listBody` — a setup const or authored import read in a list
	 * body, which the client emits only for positions outside list bodies
	 * (LT-349 ruling). `lang` is the component's `lang` binding when the
	 * site reads it, for the `host.lang` pointer; `t` is the message
	 * spelling when the site reads a message other than by a literal
	 * declared key — the `t` binding itself (a computed key, a bare `t`, an
	 * undeclared key) or, for a record-spelled read (`i18n.t.<key>`,
	 * LT-358c), the component's own `t` binding, or the canonical `t` when
	 * none is declared — for the client message channel's rule (ADR 0030
	 * s9). `channel` is the subset of `server` that IS the message channel
	 * (the `t` bindings and the reserved record's bindings): a flagged
	 * channel name earns the literal-key sentence, not the generic
	 * exposed-prop fix, which would contradict it.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-01).
	 */
	serverOnlyNames: (
		source: string,
		at: Site,
		subject: string,
		names: {
			server: readonly string[]
			module: readonly string[]
			listBody: readonly string[]
		},
		lang: string | null,
		t: string | null = null,
		channel: readonly string[] = [],
	) => {
		const { server, module, listBody } = names
		const bound = [...server, ...module]
		const them = (list: readonly string[]) =>
			list.length === 1 ? 'it' : 'them'
		const sentences: string[] = []
		if (bound.length > 0)
			sentences.push(
				`${subject} references server-only ${bound.length === 1 ? 'name' : 'names'} ${codeList(bound)} — the generated client does not bind ${them(bound)}, so the read throws when the client runs it.`,
			)
		if (listBody.length > 0)
			sentences.push(
				`${bound.length > 0 ? 'It also references' : `${subject} references`} ${codeList(listBody)}, which a list body cannot read — the client emits setup consts and imports only for positions outside list bodies.`,
			)
		if (lang !== null)
			sentences.push(
				`The locale is \`host.lang\` on the client, not \`${lang}\`.`,
			)
		if (t !== null)
			sentences.push(
				`The client receives a message only when the site reads a declared key literally — write \`${t}.<key>\` or \`${t}['<key>']\`.`,
			)
		if (
			server.some(
				name => name !== lang && name !== t && !channel.includes(name),
			)
		)
			sentences.push('Read the value through an exposed prop or from the DOM.')
		if (module.length > 0)
			sentences.push(
				`Import ${codeList(module)} from a module, or declare ${them(module)} as a const in setup.`,
			)
		if (listBody.length > 0)
			sentences.push('Read the value through an exposed prop instead.')
		return error('LTC005', sentences.join(' '), rangeOf(source, at))
	},

	/**
	 * A loop whose nearest control-flow ancestor is an `if`/`switch` branch
	 * (LT-301). The client addresses a branch's content by its roots, so a
	 * loop there binds only its first item. Diagnosed, not supported: a
	 * branch-scoped `each()` waits for a migration that needs it.
	 */
	loopInBranch: (
		source: string,
		at: Site,
		wording: SurfaceWording,
		branch: 'if' | 'switch',
	) => {
		const { inside, outOf } = wording.loopInBranch(branch)
		return error(
			'LTC005',
			`${wording.aLoop} inside ${inside} is outside the supported subset: the client addresses a branch's content by its roots, so only the loop's first item would get its bindings. Render the empty case with ${wording.emptyArmFix}, or move the loop out of ${outOf}.`,
			rangeOf(source, at),
		)
	},

	/** Attribute shape the classifier does not accept. */
	invalidAttribute: (source: string, at: Site, what: string) =>
		error('LTC006', what, rangeOf(source, at)),

	/** Element the generated client cannot address deterministically. */
	unaddressableElement: (source: string, at: Site, what: string) =>
		error('LTC007', what, rangeOf(source, at)),

	/**
	 * Source-level structure violations. `invalidSource` takes the family's
	 * `(source, at, what)` shape like its siblings (LT-223): sites that have
	 * a node in scope pass it so the report covers it; a parse failure
	 * passes the parser's position, and a file-level shape (a missing
	 * component function) passes `undefined` and reports the whole file.
	 */
	invalidSource: (source: string, at: Site, what: string) =>
		error('LTC008', what, rangeOf(source, at)),

	// --- config, managed form props, composition, pass legality ---
	/** Invalid `export const config` declaration (ADR 0024 sub-design 8). */
	invalidConfig: (source: string, at: Site, what: string) =>
		error('LTC009', what, rangeOf(source, at)),

	/**
	 * Managed form prop (`{host.validationMessage}`) without `formAssociated`
	 * — the watch source exists only on FormFactoryContext (LT-008).
	 */
	managedPropWithoutForm: (source: string, at: Site, prop: string) =>
		error(
			'LTC010',
			`\`{host.${prop}}\` reads a managed form prop — it is watchable only when formAssociated() leads the extensions. Declare \`export const config = { formAssociated: true }\` or expose a prop of that name.`,
			rangeOf(source, at),
		),

	/**
	 * A capitalized JSX tag with no matching component import (`'….tsrx'` or
	 * `'….tsx'`; ADR 0024 sub-design 10) — composition resolves by import,
	 * never falls back to raw custom-element treatment.
	 */
	unresolvedComposedComponent: (source: string, at: Site, name: string) =>
		error(
			'LTC011',
			`\`<${name}>\` has no matching \`import { ${name} }\` of a \`.tsrx\` or \`.tsx\` module — composed (capitalized) tags must import the component they compose (ADR 0024 sub-design 10). A lowercase dashed tag addresses a raw custom element instead.`,
			rangeOf(source, at),
		),

	/**
	 * A composed element's import resolved to a `.tsrx` path, but that file
	 * did not compile (or does not exist) — a cross-file resolution failure,
	 * distinct from the "no matching import" case above.
	 */
	composedComponentNotCompiled: (
		source: string,
		at: Site,
		name: string,
		path: string,
	) =>
		error(
			'LTC011',
			`\`<${name}>\` composes \`${path}\`, but that file did not compile (or was not found) — fix its own diagnostics first.`,
			rangeOf(source, at),
		),

	/**
	 * A construct in a composed element's content, or a composed element in a
	 * position, that composition does not support yet. `what` names the
	 * construct and its position as the subject of the sentence.
	 */
	composedElementUnsupported: (source: string, at: Site, what: string) =>
		error(
			'LTC011',
			`${what} is not supported yet (ADR 0024 sub-design 10). Move the construct into the composed component's own template, or out of this position.`,
			rangeOf(source, at),
		),

	/**
	 * A function-valued attribute on a custom-element target (ADR 0024
	 * sub-design 4, amended by sub-design 10) — reactive-shape inference on
	 * custom elements is gone; `pass={{ }}` is the sole client-prop channel.
	 */
	reactiveAttrOnCustomElement: (
		source: string,
		at: Site,
		tag: string,
		attr: string,
	) =>
		error(
			'LTC012',
			`Reactive attribute \`${attr}={…}\` on custom element <${tag}> is no longer bound to anything (ADR 0024 sub-design 10) — use \`pass={{ ${attr}: ${attr} }}\` for client-side signal interop, or a plain value for a static attribute.`,
			rangeOf(source, at),
		),

	/** `pass={{ }}` on a native element or an unregistered/unknown custom tag. */
	passTargetNotCustom: (source: string, at: Site, tag: string) =>
		error(
			'LTC012',
			`pass={{ … }} on <${tag}> — its target must be a registry-known custom element (ADR 0024 sub-design 10); native elements use reactive attribute bindings instead. At connect this is \`InvalidCustomElementError\`.`,
			rangeOf(source, at),
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
		at: Site,
		tag: string,
		prop: string,
		exposed: string[],
	) =>
		error(
			'LTC012',
			`pass={{ ${prop}: … }} targets <${tag}>, which does not expose \`${prop}\` — its reactive props are ${exposed.length ? exposed.map(p => `\`${p}\``).join(', ') : '(none)'}. Add \`${prop}\` to that component's \`expose({ … })\`, or pass one of the props it does declare. At connect this is \`InvalidPassPropertyError\`.`,
			rangeOf(source, at),
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
		at: Site,
		tag: string,
		prop: string,
		kind: 'computed' | 'method',
	) =>
		error(
			'LTC012',
			kind === 'method'
				? `pass={{ ${prop}: … }} targets <${tag}>, whose \`${prop}\` is a \`defineMethod()\` producer, not a reactive property — it is installed as a plain member and has no Slot to swap. Call it (\`el.${prop}()\`) from an event handler instead of passing to it. At connect this is \`InvalidPassPropertyError\`.`
				: `pass={{ ${prop}: … }} targets <${tag}>, whose \`${prop}\` is exposed READ-ONLY — a computed initializer (\`sig.get\` or \`() => …\`) is defined with a getter, not a Slot, so there is no backing signal for pass() to swap (ADR 0004). Expose \`${prop}\` from a mutable initializer on <${tag}> (a value, a Parser, or a \`{ get, set }\` descriptor) if it is meant to be driven from outside; otherwise drive it from <${tag}>'s own state. At connect this is \`InvalidPassPropertyError\`.`,
			rangeOf(source, at),
		),

	// --- imports, requestContext, children, ref spellings ---
	/**
	 * A plain (non-`.tsrx`) import whose local bindings never appear as a
	 * free identifier anywhere in setup or the template (LT-034, ADR 0024
	 * sub-design 14) — placement is inferred from usage, so an import with no
	 * detectable usage would otherwise be silently dropped rather than fail
	 * loudly.
	 */
	unusedPlainImport: (source: string, at: Site, names: string[]) =>
		warning(
			'LTC014',
			`Import ${names.map(n => `\`${n}\``).join(', ')} is never referenced in setup code or the template — it would be dropped from both generated modules. Remove it, or use it so the compiler can place it.`,
			rangeOf(source, at),
		),

	/**
	 * `requestContext(...)` called with other than exactly two arguments
	 * (LT-035, ADR 0024 sub-design 15) — `requestContext(context, fallback)`
	 * is the only recognized shape; the server needs the second argument as
	 * the signal's render-time value (there is no ancestor DOM to walk).
	 */
	invalidRequestContextCall: (source: string, at: Site, name: string) =>
		error(
			'LTC015',
			`\`${name} = requestContext(...)\` must be called with exactly two arguments: the context key and a fallback value. The fallback is what the server renders (ADR 0024 sub-design 15) — there is no ancestor DOM to walk at render time.`,
			rangeOf(source, at),
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
		at: Site,
		name: string,
		names: string[],
	) =>
		error(
			'LTC016',
			`\`${name}\`'s fallback argument references ${names.map(n => `\`${n}\``).join(', ')}, which the server cannot resolve — requestContext()'s fallback must be a literal or an expression over server args/setup, since the server renders using it directly (no ancestor DOM to walk at render time).`,
			rangeOf(source, at),
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
		at: Site,
		names: string[],
		exprText: string,
	) =>
		error(
			'LTC017',
			`${names.map(n => `\`${n}\``).join(', ')} ${names.length > 1 ? 'are' : 'is'} passed into a call the compiler cannot see inside, so it cannot tell whether this child is reactive. Wrap it in an explicit thunk: \`{() => ${exprText}}\`.`,
			rangeOf(source, at),
		),

	/**
	 * The retired `&{expr}` lazy-child sigil (LT-052). The `&` sigil has no
	 * template-child meaning — under the 0.2 pin it introduces nothing at all
	 * (lazy destructuring left the grammar), and reactivity is decided by the
	 * lift rule (`reactivity.ts`), so the sigil carries no information.
	 */
	retiredLazySigil: (source: string, at: Site, exprText: string) =>
		error(
			'TSRX018',
			`The \`&\` sigil in \`&{${exprText}}\` has no meaning in a template child — the compiler decides reactivity itself, and TSRX 0.2 removed the lazy destructuring the sigil once introduced. Drop the sigil: \`{${exprText}}\`.`,
			rangeOf(source, at),
		),

	/**
	 * A string literal naming an exposed or managed prop in child position
	 * (LT-052). This used to mean "watch this prop by name" — but only
	 * because the `&` sigil disambiguated it from ordinary text. Without the
	 * sigil `{'label'}` is indistinguishable from the literal string, so the
	 * prop read must be written explicitly.
	 */
	stringLiteralPropChild: (source: string, at: Site, prop: string) =>
		error(
			'LTC019',
			`\`{'${prop}'}\` names a prop but reads as the literal string "${prop}" — the \`&\` sigil that used to distinguish them is gone (LT-052). Write the read explicitly: \`{host.${prop}}\`.`,
			rangeOf(source, at),
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
		at: Site,
		condText: string,
		exprText: string,
	) =>
		error(
			'TSRX021',
			`\`{${exprText}}\` is the React \`&&\` conditional-render idiom — TSRX has no implicit falsy-renders-nothing rule, so this renders literally instead of conditionally. Use \`@if (${condText}) { … }\` instead.`,
			rangeOf(source, at),
		),

	/**
	 * `{cond ? <a/> : <b/>}` (LT-054): React's ternary conditional-render
	 * idiom. Same failure mode as `reactLogicalJsx` — the chosen branch
	 * stringifies instead of rendering.
	 */
	reactTernaryJsx: (
		source: string,
		at: Site,
		condText: string,
		exprText: string,
	) =>
		error(
			'TSRX022',
			`\`{${exprText}}\` is the React ternary conditional-render idiom — TSRX renders it literally (the chosen branch stringified), not conditionally. Use \`@if (${condText}) { … } @else { … }\` instead.`,
			rangeOf(source, at),
		),

	/**
	 * `.map()` producing JSX in child position (LT-054): React's list-render
	 * idiom. TSRX's loop construct is `@for`; `.map()` over server data
	 * renders literally (`Array.prototype.toString()` over the JSX nodes).
	 */
	reactMapJsx: (
		source: string,
		at: Site,
		itemName: string,
		arrayText: string,
		exprText: string,
	) =>
		error(
			'TSRX023',
			`\`{${exprText}}\` is the React \`.map()\` list-render idiom — TSRX renders it literally (the array stringified), not as a loop. Use \`@for (const ${itemName} of ${arrayText}) { … }\` instead.`,
			rangeOf(source, at),
		),

	/**
	 * `return (<>…</>)` in setup position (LT-054): React's component-return
	 * idiom. TSRX's output is the setup block's trailing JSX expression
	 * itself — there is no `return` in the sanctioned subset.
	 */
	reactReturnJsx: (source: string, at: Site) =>
		error(
			'TSRX024',
			"`return (…)` is the React component-return idiom — TSRX's output is the setup block's trailing JSX expression itself, not a return value. Drop `return`, keep the `<>…</>` as a bare expression.",
			rangeOf(source, at),
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
	invalidFirstCall: (source: string, at: Site, name: string) =>
		error(
			'LTC025',
			`\`const ${name} = first(…)\` must be called with one or two string literals — a selector alone for an optional reference (\`first('span.badge')\`, yields \`undefined\` when absent), or a selector plus a required-reason string (\`first('input', 'required')\`, throws with that reason) — so the compiler can resolve the reference structurally at compile time.`,
			rangeOf(source, at),
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
		at: Site,
		name: string,
		selector: string,
	) =>
		error(
			'LTC026',
			`\`first('${selector}', …)\` (bound to \`${name}\`) matches no element in this component's template, or uses selector syntax this compiler cannot verify structurally — supported: a tag plus any combination of \`.class\`, \`#id\`, \`[attr]\`/\`[attr="value"]\`, and comma-separated lists. Adjust the selector to match a real, statically-addressable element. A required reference that survives to runtime with no match is \`MissingElementError\`.`,
			rangeOf(source, at),
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
		at: Site,
		helper: 'first' | 'all',
		selector: string,
		reason: string,
	) =>
		error(
			'LTC026',
			`\`${helper}('${selector}', …)\` is not a valid CSS selector — ${reason}. \`querySelector\` would throw a SyntaxError on it (InvalidSelectorError at connect); fix the selector.`,
			rangeOf(source, at),
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
		at: Site,
		name: string,
		selector: string,
		count: number,
		wording: SurfaceWording,
	) =>
		error(
			'LTC027',
			`\`first('${selector}', …)\` (bound to \`${name}\`) matches ${count} elements in this component's template, and they are not all mutually-exclusive branches of the same ${wording.if} — give the target a distinguishing \`class\`/\`id\`/\`data-*\` and name it in the selector. On a COMPOSED (PascalCase) element the attribute goes on the COMPOSE SITE, not inside the child (LT-127): \`<FormSpinbutton class="lightness" />\` → \`first('form-spinbutton.lightness', …)\`.`,
			rangeOf(source, at),
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
	reservedExposeName: (source: string, at: Site, member: string) =>
		error(
			'LTC028',
			`\`expose({ ${member}: … })\` names \`${member}\`, a reserved word or Object builtin — it cannot be a reactive property, because defining an accessor for it would shadow a member every object inherits. Rename the prop (e.g. \`${member}Value\`). At connect this is \`InvalidPropertyNameError\`.`,
			rangeOf(source, at),
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
		at: Site,
		member: string,
		extension: 'formAssociated' | 'formAssociatedCheckbox',
	) =>
		error(
			'LTC028',
			`\`expose({ ${member}: … })\` shadows the \`${member}\` member ${extension}() installs on the prototype — it is managed automatically (form-participation host contract) and cannot be exposed. Remove it, or rename the reactive property if you need something similar under a different name. At connect this is \`InvalidPropertyNameError\`.`,
			rangeOf(source, at),
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
	formControlHasName: (source: string, at: Site, tag: string) =>
		error(
			'LTC029',
			`<${tag}> is a descendant of a formAssociated() component and carries a \`name\` — it would submit natively AND via the host's \`setFormValue\`, submitting the field twice. Remove \`name\` from <${tag}>; the host element is the sole form participant.`,
			rangeOf(source, at),
		),

	/**
	 * `<textarea value={…}>` (CHECKLIST §10): `value` is not a real HTML
	 * attribute on `<textarea>` — the browser silently ignores it. The
	 * initial value must be the element's text content instead. Flags every
	 * attribute-value form (static, server, or reactive-thunk) uniformly,
	 * since all three render into the same invalid server attribute.
	 */
	textareaValueAttribute: (source: string, at: Site) =>
		error(
			'LTC030',
			'`<textarea value={…}>` has no effect — `value` is not a real HTML attribute on `<textarea>` (the browser ignores it) and the pre-hydration control renders empty. Set the initial value as text content instead: `<textarea>{value}</textarea>`.',
			rangeOf(source, at),
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
	defaultOnRequiredProp: (source: string, at: Site, name: string) =>
		error(
			'LTC032',
			`Prop \`${name}\` has a default value but its type isn't marked optional — mark it \`${name}?:\` in the props type, or the default is unreachable (omitting \`${name}\` is a type error for any external caller before the default ever applies).`,
			rangeOf(source, at),
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
	impureStaticChild: (source: string, at: Site) =>
		error(
			'LTC033',
			"This child reads an ambient value (`Date`/`Intl`, a random-number generator such as `Math.random()` or `crypto.randomUUID()`, or a locale/timezone method) with no signal dependency, so it renders exactly once, server-side, at build time, forever — the build machine's clock/locale/timezone/RNG reading gets baked into the page permanently, with no client-side correction. Wrap it in a signal (e.g. `createCell(...)` set from a client-only effect) so it can be a reactive child instead, or move the computation out of the template entirely.",
			rangeOf(source, at),
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
	impureStaticAttribute: (source: string, at: Site, attrName: string) =>
		error(
			'LTC033',
			`Attribute \`${attrName}\` reads an ambient value (\`Date\`/\`Intl\`, a random-number generator such as \`Math.random()\` or \`crypto.randomUUID()\`, or a locale/timezone method) with no signal dependency, so it is rendered exactly once, server-side, at build time, forever — the build machine's clock/locale/timezone/RNG reading gets baked into the page permanently, with no client-side correction. Make it a reactive thunk (\`${attrName}={() => …}\`, which the client's first binding pass sets) or take the value as a server arg so the caller owns it.`,
			rangeOf(source, at),
		),

	/**
	 * The loop counterpart of {@link impureStaticChild} (LT-326). A
	 * server-data loop's iterable is evaluated once, server-side, at build
	 * time, and the rendered items are never re-derived on the client — so
	 * `[...items].sort(() => Math.random() - 0.5)` bakes one build-time
	 * shuffle into the page for good. Always the error form: unlike a
	 * reactive child, there is no omit-and-correct path for a loop's items.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-09-25).
	 */
	impureLoopItems: (source: string, at: Site) =>
		error(
			'LTC033',
			"This loop's items read an ambient value (`Date`/`Intl`, a random-number generator such as `Math.random()` or `crypto.randomUUID()`, or a locale/timezone method), so the server computes them exactly once, at build time — a shuffle or a generated id is baked into the page permanently, with no client-side correction. Pass the items in as an arg, already in their final order, or hold them in a `createList` and reorder it in the factory, where it runs in the browser.",
			rangeOf(source, at),
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
	unsafeLoadedAttributeDefault: (source: string, at: Site, name: string) => {
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
			rangeOf(source, at),
		)
	},

	// --- duplicate ids, import hygiene, duplicated channels ---
	/**
	 * A real `@zeix/le-truc` export (`createCell`, `deriveCell`, a parser,
	 * `defineMethod`, …) is used in authored code without a matching
	 * `import { … } from '@zeix/le-truc'` (ADR 0024 sub-design 16). Real
	 * exports are true module exports — authored sources stay valid
	 * TypeScript by construction, which is exactly what the import line
	 * declares. FactoryContext vocabulary (`expose`, `host`, `first`, …) is
	 * ambient and NEVER needs an import.
	 */
	missingRealExportImport: (source: string, at: Site, name: string) =>
		error(
			'LTC036',
			`\`${name}\` is a real '@zeix/le-truc' export used here but never imported — add \`import { ${name} } from '@zeix/le-truc'\` (FactoryContext helpers are ambient and need no import).`,
			rangeOf(source, at),
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
	contextNameInImport: (source: string, at: Site, name: string) =>
		error(
			'LTC037',
			`\`${name}\` is FactoryContext vocabulary — ambient in this host profile, not a '@zeix/le-truc' export. Remove it from the import (drop the whole line if it's the only named import left).`,
			rangeOf(source, at),
		),

	/**
	 * The same static `id` appears on more than one composed element
	 * (LT-090). A compose site's `id` materializes on that instance's host
	 * element in the initial HTML (`composeHostAttrs`) — duplicated, that is
	 * two elements sharing an id in the SAME document: invalid HTML, and
	 * id-based addressing (`first('#x')`, label `for`) resolves to at most
	 * one of them, never reliably the right one.
	 */
	duplicateComposeId: (source: string, at: Site, id: string, count: number) =>
		error(
			'LTC038',
			`id="${id}" appears on ${count} composed elements — each compose site's id is materialized on that instance's host element, so this is ${count} elements sharing an id in the same document. Give each site a distinct id, or address the instances with a static class instead.`,
			rangeOf(source, at),
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
		at: Site,
		prop: string,
		parser: string,
		formManaged: boolean,
	) =>
		warning(
			'LTC039',
			formManaged
				? `\`${prop}\` is exposed through a Parser (\`${parser}\`, which reads the host attribute) and is ALSO rendered into this component's own markup from the \`${prop}\` arg — the value ships twice, and when the host attribute is absent the Parser's fallback wins and this site's server-rendered content is overwritten on the first binding pass. On a form-associated host \`${prop}\` is the reset baseline (\`default${prop === 'checked' ? 'Checked' : 'Value'}\`) — render the host attribute too (\`<… ${prop}={${prop}}>\`) rather than dropping it; do not stop rendering the value here either, since the baseline attribute alone gives no initial DOM state for the control to mirror.`
				: `\`${prop}\` is exposed through a Parser (\`${parser}\`, which reads the host attribute) and is ALSO rendered into this component's own markup from the \`${prop}\` arg — the value ships twice, and when the host attribute is absent the Parser's fallback wins and this site's server-rendered content is overwritten on the first binding pass. Harvest it from the site instead (\`expose({ ${prop}: <ref read> })\`, HOST_PROFILE § data account) and drop the attribute, or stop rendering the value here.`,
			rangeOf(source, at),
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
		at: Site,
		name: string,
		selector: string,
	) =>
		warning(
			'LTC040',
			`\`const ${name} = first('${selector}', …)\` is declared REQUIRED, but its only match in this template sits inside a branch that may not render — the client addresses it with an existence guard either way, so the required-reason string is never thrown. Drop it (\`first('${selector}')\`) to say optional outright. For a template-owning component the compiler controls the markup, so a required-reason only earns its keep on a selector that may match markup this component did not itself render.`,
			rangeOf(source, at),
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
		at: Site,
		name: string,
		selector: string,
		existing: string,
		/** The `first()` declaration of `existing`, related (ADR 0044 s1). */
		existingAt?: Site,
	): LocalDiagnostic => {
		const reported = error(
			'LTC041',
			`\`first('${selector}', …)\` (bound to \`${name}\`) resolves to the same element as \`${existing}\` — two names for one element. Only one of them would become a query and the other would be undefined at runtime. Use \`${existing}\` in both places, or give the two elements distinguishing \`class\`/\`id\`/\`data-*\` attributes and address them separately.`,
			rangeOf(source, at),
		)
		if (existingAt?.start !== undefined)
			reported.related = [rangeOf(source, existingAt)]
		return reported
	},

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
	staticIdInTemplate: (source: string, at: Site, tag: string, id: string) =>
		warning(
			'LTC042',
			`\`<${tag} id="${id}">\` is a constant \`id\` in a template — it duplicates the moment a page places this component twice, and any \`aria-labelledby\`/\`aria-describedby\`/\`<label for>\` pointing at it resolves to the FIRST instance. Take the id as a server arg with a default instead (\`{ ${sanitizeArgName(id)} = '${id}' }\`) and render it as \`id={${sanitizeArgName(id)}}\`, so whoever instantiates the component owns the value; wire every reference from that same arg.`,
			rangeOf(source, at),
		),

	// --- signal initializer shapes ---
	/**
	 * A setup const's initializer conditionally chooses between two signal-
	 * constructor calls (`cond ? deriveCell(...) : createCell(...)`) — the
	 * initializer must be a SINGLE, unconditional call to a recognized
	 * constructor; conditional logic belongs inside the callback, not as a
	 * choice between constructors (ADR 0024 sub-design 12).
	 *
	 * Own code since LT-165 (was `LTC013`). It is a FORMAT rule, not a
	 * server-evaluation guard: harvest planning needs one shape to plan for,
	 * and no tier supersedes that — so unlike its former code-mates it stays
	 * an error rather than becoming a routing signal (ADR 0029 s5).
	 */
	conditionalSignalConstructor: (source: string, at: Site, name: string) =>
		error(
			'LTC044',
			`\`${name}\`'s initializer conditionally chooses between two signal-constructor calls — a signal must be a single, unconditional call to a recognized constructor (createCell/createState/deriveCell/…). Move the condition inside the callback instead (e.g. \`deriveCell(() => cond ? a : b)\`).`,
			rangeOf(source, at),
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
	deferredCollectorCall: (source: string, at: Site, helper: string) =>
		error(
			'LTC045',
			`\`${helper}(…)\` is called from inside a callback — it collects an effect descriptor into the factory's ambient collector, which is gone by the time a deferred callback runs, so this throws NoActiveCollectorError at connect (contained per ADR 0028, so the effect silently never activates). Call \`${helper}(…)\` directly in setup and make the callback's condition part of the effect instead (e.g. \`watch(() => cond ? … : …, sink)\`).`,
			rangeOf(source, at),
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
		at: Site,
		name: string,
		badNames: string[],
	) =>
		error(
			'LTC046',
			`The server render evaluates \`${name}\` — in the markup or in an \`expose()\` initializer — but its initializer reads ${codeList(badNames)}, which ${badNames.length === 1 ? 'exists' : 'exist'} only on the client. No tier can produce that value, so the site renders wrong or stays empty, and no client binding corrects a static value. Compute \`${name}\` from a server arg or a signal instead, or make each site that reads it reactive (a thunk, for example \`title={() => …}\`), so the client's first binding pass supplies the value.`,
			rangeOf(source, at),
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
	 * or more adjacent letters — a single-letter fragment (a unit symbol, a
	 * separator) is page data, not prose. Per ADR 0028 this is Tier 1
	 * (Prevented): the string ships untranslatable unless the author routes
	 * it through the catalog.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-01).
	 */
	untranslatedLiteral: (source: string, at: Site, sample: string) =>
		warning(
			'LTC047',
			`Literal prose \`${sample}\` is written directly in the template of a component that declares \`export const i18n\` — no locale can translate it. Add a message key with this text as its source-locale value to \`export const i18n\`, and render \`{t.<key>}\` here; the translation census then reports each locale that lacks the key.`,
			rangeOf(source, at),
		),

	/**
	 * An `export const i18n` value that is not a supported ICU MessageFormat
	 * 1 pattern (LT-250, ADR 0030 s4). The source locale is the fallback
	 * every other locale resolves against, so it has nothing to fall back
	 * to — unlike a translation, whose parse failure falls back to this
	 * pattern and is a census record. `reason` is the parser's own account
	 * (a syntax error with line/column, or an unsupported formatter).
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-01).
	 */
	unparseableMessage: (source: string, at: Site, key: string, reason: string) =>
		error(
			'LTC055',
			`The source message \`${key}\` in \`export const i18n\` is not a supported ICU MessageFormat 1 pattern: ${reason}. The source locale has no fallback, so the build cannot render it. Correct the pattern: quote a literal \`{\`, \`}\` or \`#\` with apostrophes (\`'{'\`), and double a literal apostrophe (\`''\`).`,
			rangeOf(source, at),
		),

	/**
	 * A `t.<key>` site that disagrees with the key's parsed source pattern
	 * (LT-250, ADR 0030 s4): the call's argument record is missing an
	 * argument the pattern reads, passes one it never reads, is not an
	 * object literal the build can check, or the site calls an
	 * argument-less message / reads an argument message without calling
	 * it. `problem` is the clause naming which, after `t.<key>`; `fix` is
	 * the imperative sentence, with a call spelled from the pattern's own
	 * arguments (`i18n.ts`'s `reportMessageCallSites`).
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-01).
	 */
	messageArgumentMismatch: (
		source: string,
		at: Site,
		key: string,
		problem: string,
		fix: string,
	) => error('LTC055', `\`t.${key}\` ${problem}. ${fix}`, rangeOf(source, at)),

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
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-01). Corpus-level: fires once per involved file,
	 * located at that whole file, with every other declaring file related
	 * (ADR 0044 s1).
	 */
	duplicateTag: (
		tag: string,
		sources: ReadonlyArray<string>,
		at: DiagnosticLocation,
		related: DiagnosticLocation[],
	): CompileDiagnostic =>
		corpusError(
			'LTC048',
			`Component tag \`${tag}\` is declared by more than one corpus source: ${sources.join(', ')}. A tag has one owner, whatever surface it is written in — only a variant set shares a tag, and a variant set is at most one source per surface (\`.tsrx\`, \`.tsx\`) with one base name in one folder. Delete the extra same-surface source, move the spellings into one folder under one base name, or rename the tag of one source.`,
			at,
			related,
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
	 * Two faces (ADR 0033 s10, LT-304): the authored sheets differ, or the
	 * sheets agree but the members stop the scope at different boundary
	 * sets — each member's boundaries are the custom elements its own
	 * lowered template renders, so the same sheet emits different CSS. The
	 * caller passes `boundaries` (source → boundary tags) only for the
	 * second face; copying styles cannot fix it, so it names the sets.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-402). Corpus-level: fires once per involved
	 * file, located at that whole file, with every other member related
	 * (ADR 0044 s1).
	 */
	variantCssDrift: (
		tag: string,
		sources: ReadonlyArray<string>,
		at: DiagnosticLocation,
		related: DiagnosticLocation[],
		boundaries?: ReadonlyMap<string, readonly string[]>,
	): CompileDiagnostic =>
		corpusError(
			'LTC051',
			boundaries
				? `Variant set \`${tag}\` has the same styles in every member, but its members render different custom elements, so the scope stops at different boundaries: ${sources
						.map(source => {
							const tags = boundaries.get(source) ?? []
							return `${source} stops at ${tags.length ? tags.map(t => `<${t}>`).join(', ') : 'no custom element'}`
						})
						.join(
							'; ',
						)} — the build writes one stylesheet for the whole set, so it wrote no artifact of the set. Make every member render the same custom elements.`
				: `Variant set \`${tag}\` compiles to different CSS across its members: ${sources.join(', ')} — the build writes one stylesheet for the whole set, so it wrote no artifact of the set. Make the styles of every member byte-identical: copy the styles of the served member into the others.`,
			at,
			related,
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
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-01).
	 */
	badFactoryContextParam: (
		source: string,
		at: Site,
		bad: ReadonlyArray<string>,
	) =>
		error(
			'LTC049',
			`The factory-context parameter destructures ${codeList(bad)}, which ${bad.length === 1 ? 'is' : 'are'} not FactoryContext vocabulary — the generated client destructures the same names from its own factory context, where ${bad.length === 1 ? 'it does' : 'they do'} not exist. Destructure only ${codeList(['host', 'first', 'all', 'expose', 'watch', 'on', 'pass', 'internals', 'requestContext', 'provideContexts'])}, for example \`, { host, expose }: FactoryContext<Props>\`.`,
			rangeOf(source, at),
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
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-01). The report covers the written type, not the
	 * whole parameter (LT-358b). Neither face carries a fix (ADR 0044 s1,
	 * LT-371): the plain face names two repairs, and renaming the written
	 * type on the form-associated face leaves `FormFactoryContext`
	 * unimported — the `import type` that would need the same edit is
	 * one the import scan skips.
	 */
	formContextMismatch: (
		source: string,
		annotation: Site,
		annotated: 'FactoryContext' | 'FormFactoryContext',
	) =>
		error(
			'LTC050',
			annotated === 'FactoryContext'
				? `This component sets \`config.formAssociated\` but annotates its factory context as \`FactoryContext\`, so \`host\` lacks the managed form members the element carries. Annotate \`FormFactoryContext<Props>\` instead — its \`host\` is \`FormAssociatedElement & Props\`.`
				: `This component annotates its factory context as \`FormFactoryContext\` but does not set \`config.formAssociated\`, so \`host\` claims form members the element does not carry. Annotate \`FactoryContext<Props>\` instead, or set \`config.formAssociated\` if the component takes part in forms.`,
			rangeOf(source, annotation),
		),

	// --- Stylesheet grammar (ADR 0033 s9, LT-268) ---

	/**
	 * The component's stylesheet does not parse (ADR 0033 s9, LT-268). The
	 * sheet is emitted as authored, so a malformed sheet would ship its
	 * own breakage; there is no compiled form to fall back to. ADR 0028
	 * tier 1 (Prevented): the parser's refusal is the decision, no runtime
	 * half exists.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (final copy 2026-10-02, LT-395).
	 */
	malformedStyleSheet: (source: string, at: Site, detail: string) =>
		error(
			'LTC064',
			`The component's stylesheet does not parse (${detail}) — the compiler cannot scope or emit a sheet it cannot read. Correct the CSS syntax.`,
			rangeOf(source, at),
		),

	/**
	 * A declaration in the component's stylesheet names a property the CSS
	 * grammar does not define (ADR 0033 s9, LT-268). Browsers drop unknown
	 * declarations, so the authored rule would silently do nothing —
	 * usually a typo'd name. css-tree's dictionary arbitrates; vendor and
	 * hack prefixes resolve inside it. ADR 0028 tier 2 (Contained, LT-394):
	 * the dictionary lags the platform, so a property newer than it reports
	 * too — a warning, and the declaration ships as authored.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (final copy 2026-10-02, LT-395).
	 */
	unknownCssProperty: (source: string, at: Site, property: string) =>
		warning(
			'LTC065',
			`\`${property}\` is not a CSS property the compiler knows — a browser drops a declaration it does not recognize. Correct the name if it is a typo. If the property is newer than the compiler's CSS dictionary, ignore this warning: the declaration ships as written.`,
			rangeOf(source, at),
		),

	/**
	 * A declaration in the component's stylesheet carries a value outside
	 * its property's grammar (ADR 0033 s9, LT-268) — an unknown unit, a
	 * malformed value. The sheet ships as authored, so the dead declaration
	 * would ship too. Custom properties and `var()`/`env()` references are
	 * exempt (any value is valid for them); at-rule descriptors are not
	 * properties and are never matched. ADR 0028 tier 2 (Contained,
	 * LT-394): the dictionary lags the platform (`container-type:
	 * scroll-state`, `calc-size()`), so a newer value reports too — a
	 * warning, and the declaration ships as authored.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (final copy 2026-10-02, LT-395).
	 */
	invalidCssValue: (
		source: string,
		at: Site,
		property: string,
		value: string,
	) =>
		warning(
			'LTC065',
			`The value \`${value}\` does not match the grammar of \`${property}\` that the compiler knows — a browser drops a declaration whose value it does not accept. Correct the value if it is a mistake. If the value is newer than the compiler's CSS dictionary, ignore this warning: the declaration ships as written.`,
			rangeOf(source, at),
		),

	// --- Shadow-root stylesheet contract (ADR 0033 s6/s6a, LT-304) ---

	/**
	 * A rule in the component's stylesheet is led by the component's own tag
	 * (ADR 0033 s6, LT-304). A compiled sheet is shadow-root CSS: bare
	 * selectors style the component's internals, and the host is styled
	 * through `:host`. Tag-led authoring was the 2.x form; under the scoped
	 * emission a tag-led rule would silently stop styling the host — the tag
	 * compound addresses the element INSIDE the scope, and the scope root
	 * itself is never its own descendant. ADR 0028 tier 1 (Prevented):
	 * statically decidable, no runtime half.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-402 — the LT-304 first draft, finalized).
	 */
	ownTagLedRule: (source: string, at: Site, tag: string) =>
		error(
			'LTC066',
			`This rule is led by the component's own tag \`${tag}\`. A compiled stylesheet is shadow-root CSS: bare selectors style the component's internals, and the host element is styled through \`:host { … }\`. A \`${tag} { … }\` rule would silently stop applying — the selector addresses a nested \`<${tag}>\` inside the scope, not the host. Style the host through \`:host\`, and drop the tag from selectors that mean the component's own internals.`,
			rangeOf(source, at),
		),

	/**
	 * `::slotted()` in a component stylesheet (ADR 0033 s6, LT-304). Slotted
	 * content exists only in a shadow root; a compiled component renders
	 * light DOM, where the composed child's markup is real children, not
	 * slotted nodes — the rule could never match. Shadow-mode emission
	 * (ADR 0033 s8) is not the compiled contract. ADR 0028 tier 1
	 * (Prevented): statically decidable, no runtime half.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-402 — the LT-304 first draft, finalized).
	 */
	slottedInLightDom: (source: string, at: Site) =>
		error(
			'LTC067',
			"`::slotted()` cannot match in a compiled component: it addresses slotted content, which exists only inside a shadow root, and a compiled component renders light DOM — composed children are real children, not slotted nodes. Style a composed child's host element by its tag, and let the child style its own internals.",
			rangeOf(source, at),
		),

	/**
	 * `:host-context()` in a component stylesheet (ADR 0033 s6, LT-304).
	 * Removed from the CSS spec and matched by no browser — in a shadow root
	 * it would style the host by its ancestors, and the light-DOM scoping
	 * has no equivalent that keeps the page's own rules winning over the
	 * host's. ADR 0028 tier 1 (Prevented): statically decidable, no runtime
	 * half.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-402 — the LT-304 first draft, finalized).
	 */
	hostContextSelector: (source: string, at: Site) =>
		error(
			'LTC068',
			'`:host-context()` is removed from the CSS spec and matched by no browser, so the rule could never apply. Theme the component by ancestor through inheritance and custom properties instead — custom properties cross every boundary.',
			rangeOf(source, at),
		),

	/**
	 * `:host` directly followed by a qualifier (ADR 0033 s6, LT-304; R3,
	 * owner 2026-10-02). `:host.x`, `:host:hover` and `:host[attr]` match
	 * nothing in a shadow root — the compound on the bare `:host`
	 * pseudo-class has no matchable form; the qualifier belongs in the
	 * pseudo-class's arguments: `:host(.x)`, `:host(:hover)`,
	 * `:host([attr])`. ADR 0028 tier 1 (Prevented): statically decidable,
	 * no runtime half.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-402 — the LT-304 first draft, finalized).
	 */
	hostQualifier: (source: string, at: Site) =>
		error(
			'LTC070',
			'`:host` followed directly by a qualifier matches nothing in a shadow root — a compound on the bare `:host` pseudo-class has no matchable form. Move the qualifier into the arguments: `:host(.x)`, `:host(:hover)`, `:host([attr])`.',
			rangeOf(source, at),
		),

	/**
	 * A selector that descends past a boundary tag (ADR 0033 s6, LT-399):
	 * a compound naming a custom element the template renders, followed by
	 * a descendant or child combinator. The subject is that child's content;
	 * the scope limit (native) and the guard (lowered) always exclude it, so
	 * the rule matches nothing — as a shadow root's sheet cannot reach into
	 * a child's shadow root. Sibling combinators stay legal, and so does
	 * styling the child's own tag. ADR 0028 tier 1 (Prevented): statically
	 * decidable, no runtime half.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-402 — the LT-399 first draft, finalized).
	 */
	descendsPastBoundary: (
		source: string,
		at: Site,
		selector: string,
		boundary: string,
	) =>
		error(
			'LTC071',
			`The selector \`${selector}\` reaches inside \`<${boundary}>\`, a custom element this component renders — the scope stops at it, so the rule matches nothing. Style that content from \`<${boundary}>\`'s own stylesheet, or, for a page-level rule, move it into a top-level \`:global { … }\` block.`,
			rangeOf(source, at),
		),

	/**
	 * `:global` in a form other than the two whole-rule forms (ADR 0033
	 * s6a, LT-304). The admitted forms are a top-level
	 * `:global(<whole selector>) { … }` rule and a top-level bare `:global
	 * { … }` block, both hoisted out of the scope and emitted unwrapped;
	 * every other spelling would either reach past the boundary into
	 * composed children's markup (nested, prefixed, leading-ancestor — the
	 * data account forbids it), do nothing (trailing — classes are never
	 * rewritten, so the wrapper is a no-op), be an error in TSRX too
	 * (mid-selector), or style nothing (declarations directly in a bare
	 * block). `face` names which; each carries its own reason in the copy.
	 * ADR 0028 tier 1 (Prevented): statically decidable, no runtime half.
	 *
	 * Message copy follows ADR 0028's lifecycle (`writer` → error-messages)
	 * (reviewed 2026-10-02, LT-402 — the LT-304 first draft, finalized).
	 */
	globalMisuse: (
		source: string,
		at: Site,
		face:
			| 'nested'
			| 'prefixed'
			| 'trailing'
			| 'leading-ancestor'
			| 'mid-selector'
			| 'declarations',
	) =>
		error(
			'LTC069',
			face === 'nested'
				? 'This `:global` sits inside another rule or block. A global rule escapes the component scope, so from inside a rule it would reach past the boundary into composed children — hoist it to the top level of the stylesheet instead: a whole `:global(<selector>) { … }` rule or a bare `:global { … }` block (an at-rule-conditioned global rides in the bare block: `:global { @media … }`).'
				: face === 'prefixed'
					? "This `:global(<selector>)` is followed by more selector. A global escape owns the whole rule; extending it would address markup past the boundary into composed children. Hoist the rule to the top level as `:global(<whole selector>) { … }`, or drop the wrapper if the selector means this component's own internals."
					: face === 'trailing'
						? 'This `:global(…)` trails a selector, so it wraps nothing that needs escaping — classes are never rewritten, and the compiled selector keeps the compound as written. Drop the wrapper and write the compound plainly.'
						: face === 'leading-ancestor'
							? 'This selector starts at `:global(…)` and then descends into the component. A leading global ancestor has no shadow-root equivalent — the page cannot reach into the component from outside, and inside the scope the descendant needs no escape. Style internals with bare selectors; a genuinely page-level rule hoists as `:global(<whole selector>) { … }`.'
							: face === 'mid-selector'
								? "This `:global(…)` sits in the middle of a selector, which is an error in TSRX too. Split the rule: the component's own compounds style internals with bare selectors, and a genuinely page-level rule hoists as `:global(<whole selector>) { … }` at the top level."
								: 'These declarations sit directly in a bare `:global { … }` block, which carries no selector — they style nothing. Put them under a selector: a `:global(<selector>) { … }` rule, or a rule inside the block.',
			rangeOf(source, at),
		),
}
