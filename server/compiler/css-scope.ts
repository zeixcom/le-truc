/**
 * Scoped emission of authored `@scope` CSS (ADR 0033, LT-501).
 *
 * A compiled sheet means what the same sheet would mean as an inline
 * `<style>` in its host. Scoping is authored with native `@scope`: a
 * prelude-less `@scope { … }` is scoped to the host, `to (…)` sets the
 * limits, and the compiler adds none of its own. The sheet leaves the host
 * for the component's stylesheet, so the emission restores what the inline
 * placement gave for free:
 *
 * - **Native** (every CSS target supports `@scope`): the sheet ships as
 *   authored. A prelude-less `@scope` gains the explicit root
 *   `@scope (<tag>)`; a preluded one, the block bodies and every other rule
 *   stay verbatim.
 * - **Lowered** (a target without `@scope`): each component `@scope` block
 *   unwraps into flat selectors. The root leads as `:where(<root>)` —
 *   the idiom's `:where(:scope)` host rule is exactly that lead — a bare
 *   `:scope` becomes the root compound padded to its (0,1,0) specificity,
 *   and each authored limit becomes a zero-specificity guard.
 *   Top-level rules outside `@scope` stay verbatim.
 *
 * EMISSION STRATEGY (the LT-268 review hazard): the lightningcss 1.33
 * WRITE path — returning nodes from a visitor — crashes with
 * "failed to deserialize … Specifier" whenever a nested rule's declaration
 * holds `var()` (upstream parcel-bundler/lightningcss#1065, tracked with
 * #1081; the read-only and plain-`transform` directions are unaffected).
 * Emission therefore never returns nodes: the sheet is partitioned at the
 * TEXT level over lightningcss's read-only parse, the lowered remainder is
 * flattened through a plain `transform()` (Rust→JS only, the direction
 * every plain build already exercises) so nesting never reaches the
 * surgery, and every selector rewrite is a string splice — the checks read
 * lightningcss's deserialized selector components, the emission never
 * parses selectors at all. Bumping lightningcss must re-probe the plain
 * path with `var()` in nested rules before any visitor-based emission is
 * considered.
 *
 * The flattening pass runs with the configured targets and nesting forced
 * into the lowering (ADR 0033 s4: the lowered emission is flat selectors).
 * Everything else lowers only as far as the real targets demand — the
 * default (Baseline widely available) keeps every Baseline-2023 feature
 * authored. `:where()` and complex `:not()` — the lowering's own
 * vocabulary — are Baseline 2021, within the runtime's baseline, so the
 * guard never needs lowering.
 *
 * `@keyframes`/`@font-face`/`@property` and the other hoisted at-rules emit
 * verbatim.
 */

import { Features, transform } from 'lightningcss-wasm'
import type { CssBrowser, CssTargets } from './emit-paths'

/* === Types === */

/** How the sheet is scoped: native `@scope` or the flat-selector lowering. */
export type ScopeMode = 'native' | 'lowered'

/** The authored forms with no meaning under the platform-CSS contract. */
export type ContractFace =
	/** A rule inside `@scope` led by the component's own tag (fix-it: `:where(:scope)`). */
	| 'own-tag-led'
	/** `::slotted()` in a light-DOM component. */
	| 'slotted'
	/** `:host-context()` anywhere (removed from the spec). */
	| 'host-context'
	/** `:host` anywhere — it matches nothing outside a shadow root (fix-it: `:where(:scope)`). */
	| 'host'
	/** `:global` anywhere — an unscoped rule is a top-level rule. */
	| 'global'
	/** A selector descending past a compound one of its block's limits excludes. */
	| 'dead-by-limit'

/** One authored-form finding over the sheet (ADR 0033 s6). */
export type ContractFinding = {
	face: ContractFace
	/** The offending selector, summarized, for the message body. */
	selector: string
	/** For the `dead-by-limit` face: the limit that excludes the subject. */
	limit?: string
	/** 0-based offset within the sheet text, when known. */
	offset?: number | undefined
	/** Where the rule's selector list ends (exclusive), when known. */
	end?: number | undefined
}

/** Why the lowering cannot express an authored `@scope` form (ADR 0033 s4). */
export type LoweringFace =
	/** A `@scope` inside a component `@scope`. */
	| 'nested-scope'
	/** A limit that names `:scope` or `&`. */
	| 'scope-in-limit'

/** One `@scope` form the lowered emission cannot express (LTC089). */
export type LoweringFinding = {
	face: LoweringFace
	/** 0-based offset of the `@scope` rule within the sheet text. */
	offset: number | undefined
	/** Where the `@scope` prelude ends (exclusive), when known. */
	end?: number | undefined
}

/* === Deserialized lightningcss shapes (read structurally, never written) === */

type LcComponent = {
	type: string
	name?: string
	kind?: string
	value?: string
	selectors?: unknown
}
type LcSelector = LcComponent[]
type LcRule = {
	type: string
	value?: {
		selectors?: LcSelector[]
		scopeEnd?: LcSelector[] | null
		rules?: LcRule[]
		loc?: { line: number; column: number }
	}
}

/* === The CSS target === */

/** Packed `@scope` support: Chrome/Edge 118, Firefox 128, Safari 17.4. */
const SCOPE_SUPPORT: Record<CssBrowser, number> = {
	chrome: 118 << 16,
	edge: 118 << 16,
	firefox: 128 << 16,
	safari: (17 << 16) | (4 << 8),
}

/**
 * Native `@scope` or the flat-selector lowering: native only when EVERY
 * browser the target names supports `@scope`; a target naming none lowers.
 */
export const scopeModeOf = (targets: CssTargets): ScopeMode => {
	const named = Object.entries(targets) as [CssBrowser, number][]
	if (named.length === 0) return 'lowered'
	return named.every(([browser, version]) => version >= SCOPE_SUPPORT[browser])
		? 'native'
		: 'lowered'
}

/**
 * The configured CSS target in prose, for a diagnostic that names it
 * (LTC089): `chrome 118, safari 17.3`, or the absence of any named browser.
 */
export const describeCssTargets = (targets: CssTargets): string => {
	const named = Object.entries(targets) as [CssBrowser, number][]
	if (named.length === 0) return 'no named browser'
	return named
		.map(([browser, packed]) => {
			const minor = (packed >> 8) & 0xff
			return `${browser} ${packed >> 16}${minor ? `.${minor}` : ''}`
		})
		.join(', ')
}

/**
 * The flattening pass's transform options: the REAL targets, with nesting
 * forced on (`include`) — nesting always lowers (ADR 0033 s4: the lowered
 * sheet is flat), whatever the target names, and nothing else lowers
 * beyond what the targets demand (LT-398). `light-dark()` is EXCLUDED
 * from lowering: the default's Safari 17.4 predates it, and its lowering
 * rewrites a declaration into `var(--lightningcss-light, …)
 * var(--lightningcss-dark, …)`, a two-value background that is invalid at
 * computed-value time. Authored `light-dark()` ships and the page bundle's
 * own lowering (with its companion definitions) handles it.
 */
const flatteningTargets = (
	targets: CssTargets,
): { targets: CssTargets; include: number; exclude: number } => ({
	targets,
	include: Features.Nesting,
	exclude: Features.LightDark,
})

/* === The authored-form checks (ADR 0033 s6) === */

/**
 * At-rule types whose blocks hold real rules the checks descend into.
 * `@keyframes`/`@font-face`/`@property` hoist verbatim and their blocks
 * hold descriptors or keyframe selectors (`from`/`to`/percentages), never
 * component selectors — never descended into.
 */
const RECURSABLE_AT_RULES = new Set([
	'media',
	'supports',
	'container',
	'layer-block',
	'scope',
	'starting-style',
])

/** Every component of a selector, descending into functional pseudo-classes. */
const forEachComponent = (
	selector: LcSelector,
	visit: (component: LcComponent) => void,
): void => {
	for (const component of selector) {
		visit(component)
		const inner = component.selectors
		if (!Array.isArray(inner) || inner.length === 0) continue
		// `:is()`/`:not()`/`:has()` carry a selector LIST, `:host()` one selector.
		if (Array.isArray(inner[0]))
			for (const member of inner as LcSelector[])
				forEachComponent(member, visit)
		else forEachComponent(inner as LcSelector, visit)
	}
}

const isGlobalPseudo = (component: LcComponent): boolean =>
	component.type === 'pseudo-class' &&
	(component.kind === 'custom' || component.kind === 'custom-function') &&
	component.name === 'global'

const COMBINATOR_TEXT: Record<string, string> = {
	descendant: ' ',
	child: ' > ',
	'next-sibling': ' + ',
	'later-sibling': ' ~ ',
}

/** The deserialized selector's authored text is not carried — summarize it. */
const selectorTextOf = (selector: LcSelector): string =>
	selector
		.map(component => {
			if (component.type === 'combinator')
				return COMBINATOR_TEXT[component.value ?? ''] ?? ` ${component.value} `
			if (component.type === 'nesting') return '&'
			if (component.type === 'universal') return '*'
			if (component.type === 'type') return `${component.name ?? ''}`
			if (component.type === 'class') return `.${component.name ?? ''}`
			if (component.type === 'pseudo-element')
				return `::${component.kind ?? component.name ?? ''}`
			if (component.type === 'pseudo-class')
				return component.kind === 'custom' ||
					component.kind === 'custom-function'
					? `:${component.name ?? component.kind}(…)`
					: `:${component.kind ?? ''}`
			return component.name ?? `[${component.type}]`
		})
		.join('')

/**
 * A rule finding's range (ADR 0044 s1, LT-371): lightningcss locates a
 * rule by its start only, so the selector list runs from there to the
 * rule's `{`, trailing whitespace trimmed.
 */
const withSelectorEnd = <F extends { offset?: number | undefined }>(
	sheetText: string,
	finding: F,
): F & { end?: number | undefined } => {
	if (finding.offset === undefined) return finding
	// A relative selector's parse anchor replaced the whitespace before it
	// (`anchorRelativeSelectors`), so its loc sits one character early.
	let offset = finding.offset
	while (/\s/.test(sheetText[offset] ?? '')) offset++
	const brace = sheetText.indexOf('{', offset)
	if (brace < 0) return finding
	let end = brace
	while (end > offset && /\s/.test(sheetText[end - 1] ?? '')) end--
	return { ...finding, offset, end }
}

/** 0-based-line/1-based-column loc → offset within the sheet text. */
const lineStartsOf = (text: string): number[] => {
	const starts = [0]
	for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
	return starts
}

const locToOffset = (
	lineStarts: readonly number[],
	loc: { line: number; column: number },
): number => (lineStarts[loc.line] ?? 0) + Math.max(0, loc.column - 1)

/**
 * The dedented sheet text, with how much each line lost: the emission
 * partitions and slices a canonical copy so the artifact never varies with
 * the authored sheet's indentation — a variant set's members may sit at
 * different depths, and their emissions must be byte-identical (the same
 * reasoning as LTC051's dedent comparison). `strip[line]` is what the
 * dedent removed from that line, so a parsed loc's column shifts by it.
 */
const dedentWithStrips = (text: string): { text: string; strip: number[] } => {
	const lines = text.split('\n')
	const indents = lines
		.filter(line => line.trim().length > 0)
		.map(line => line.match(/^[ \t]*/)?.[0] ?? '')
	const common = indents.length
		? (indents.reduce((min, ind) => (ind.length < min.length ? ind : min)) ??
			'')
		: ''
	const strip = lines.map(line =>
		line.startsWith(common)
			? common.length
			: (line.match(/^[ \t]*/)?.[0].length ?? 0),
	)
	return {
		text: lines.map((line, index) => line.slice(strip[index] ?? 0)).join('\n'),
		strip,
	}
}

/** A parsed loc's offset within the dedented text, per-line shifts applied. */
const shiftedLocToOffset = (
	lineStarts: readonly number[],
	strip: readonly number[],
	loc: { line: number; column: number },
): number =>
	(lineStarts[loc.line] ?? 0) +
	Math.max(0, loc.column - 1 - (strip[loc.line] ?? 0))

/* --- Limits: the dead-rule check (LTC071) --- */

/** A flat selector split at its combinators: compounds and the combinators between. */
type Compounds = { compounds: LcComponent[][]; combinators: string[] }

const compoundsOf = (selector: LcSelector): Compounds => {
	const compounds: LcComponent[][] = [[]]
	const combinators: string[] = []
	for (const component of selector) {
		// `::before` and kin ride in the compound they end.
		if (
			component.type === 'combinator' &&
			component.value !== 'pseudo-element' &&
			component.value !== 'slot-assignment'
		) {
			combinators.push(component.value ?? '')
			compounds.push([])
		} else compounds[compounds.length - 1]?.push(component)
	}
	return { compounds, combinators }
}

const sameCompound = (a: LcComponent[], b: LcComponent[]): boolean =>
	JSON.stringify(a) === JSON.stringify(b)

/**
 * Resolve one selector against one parent alternative into a flat
 * selector: `&` becomes the parent, a nested selector without `&` is
 * relative and gets an implicit `& ` lead. At the top of a `@scope` block
 * (no parent) `&` is the scope root, `:scope`.
 */
const resolveAgainst = (
	selector: LcSelector,
	parent: LcSelector | null,
): LcSelector => {
	const root: LcComponent = { type: 'pseudo-class', kind: 'scope' }
	if (!selector.some(component => component.type === 'nesting')) {
		return parent
			? [...parent, { type: 'combinator', value: 'descendant' }, ...selector]
			: selector
	}
	return selector.flatMap(component =>
		component.type === 'nesting' ? (parent ?? [root]) : [component],
	)
}

/**
 * Whether a flat selector's subject always lies inside what one limit
 * excludes: some run of its compounds equals the limit and a descendant or
 * child combinator follows. A limit of the form `<X> > *` also excludes
 * everything inside `<X>`, so a run equal to `<X>` followed that way is
 * dead too — the shape `to (<child-tag> > *)` takes.
 */
const deadByLimit = (selector: LcSelector, limit: LcSelector): boolean => {
	const subject = compoundsOf(selector)
	const excluded = compoundsOf(limit)
	const universalTail =
		excluded.compounds.length > 1 &&
		excluded.combinators[excluded.combinators.length - 1] === 'child' &&
		excluded.compounds[excluded.compounds.length - 1]?.length === 1 &&
		excluded.compounds[excluded.compounds.length - 1]?.[0]?.type === 'universal'
	const heads = [excluded]
	if (universalTail)
		heads.push({
			compounds: excluded.compounds.slice(0, -1),
			combinators: excluded.combinators.slice(0, -1),
		})
	for (const head of heads) {
		const length = head.compounds.length
		for (let end = length - 1; end < subject.compounds.length - 1; end++) {
			const next = subject.combinators[end]
			if (next !== 'descendant' && next !== 'child') continue
			const start = end - length + 1
			const matches =
				head.compounds.every((compound, index) =>
					sameCompound(subject.compounds[start + index] ?? [], compound),
				) &&
				head.combinators.every(
					(combinator, index) =>
						subject.combinators[start + index] === combinator,
				)
			if (matches) return true
		}
	}
	return false
}

/** What a scope block hands its rules: its authored limits. */
type ScopeBlock = { limits: LcSelector[] }

/**
 * `styleDepth` counts enclosing STYLE rules only — a rule inside a
 * conditional group of a `@scope` is still a top-level scoped rule for the
 * own-tag-led face. `parents` carries each enclosing rule's resolved flat
 * alternatives for the limit check.
 */
const checkRules = (
	rules: readonly LcRule[],
	tag: string,
	scope: ScopeBlock | null,
	styleDepth: number,
	parents: readonly LcSelector[] | null,
	lineStarts: readonly number[],
	findings: ContractFinding[],
): void => {
	for (const rule of rules) {
		if (rule.type === 'style') {
			const value = rule.value
			const selectors = value?.selectors ?? []
			const offset = value?.loc ? locToOffset(lineStarts, value.loc) : undefined
			const seen = new Set<ContractFace>()
			const report = (
				face: ContractFace,
				selector: LcSelector,
				limit?: string,
			): void => {
				if (seen.has(face)) return
				seen.add(face)
				findings.push({
					face,
					selector: selectorTextOf(selector),
					...(limit !== undefined ? { limit } : {}),
					offset,
				})
			}
			const resolved: LcSelector[] = []
			const dead: string[] = []
			let deadLimit: string | undefined
			for (const selector of selectors) {
				const first = selector[0] as LcComponent | undefined
				if (
					scope &&
					styleDepth === 0 &&
					first?.type === 'type' &&
					first.name?.toLowerCase() === tag
				)
					report('own-tag-led', selector)
				forEachComponent(selector, component => {
					if (
						component.type === 'pseudo-element' &&
						component.kind === 'slotted'
					)
						report('slotted', selector)
					if (
						component.type === 'pseudo-class' &&
						component.kind === 'custom-function' &&
						component.name === 'host-context'
					)
						report('host-context', selector)
					else if (
						component.type === 'pseudo-class' &&
						component.kind === 'host'
					)
						report('host', selector)
					if (isGlobalPseudo(component)) report('global', selector)
				})
				if (scope) {
					const alternatives = (parents ?? [null]).map(parent =>
						resolveAgainst(selector, parent),
					)
					resolved.push(...alternatives)
					// Dead only when dead under EVERY parent alternative.
					for (const limit of scope.limits) {
						if (alternatives.every(flat => deadByLimit(flat, limit))) {
							dead.push(selectorTextOf(selector))
							deadLimit ??= selectorTextOf(limit)
							break
						}
					}
				}
			}
			// One finding per rule, naming every dead member of its list.
			if (deadLimit !== undefined)
				findings.push({
					face: 'dead-by-limit',
					selector: dead.join(', '),
					limit: deadLimit,
					offset,
				})
			checkRules(
				value?.rules ?? [],
				tag,
				scope,
				styleDepth + 1,
				scope ? resolved : null,
				lineStarts,
				findings,
			)
			continue
		}
		if (rule.type === 'scope') {
			// The outermost `@scope` is the component's; a nested one keeps
			// the component's block (LTC089 flags it on lowered targets).
			checkRules(
				rule.value?.rules ?? [],
				tag,
				scope ?? { limits: rule.value?.scopeEnd ?? [] },
				styleDepth,
				scope ? parents : null,
				lineStarts,
				findings,
			)
			continue
		}
		if (RECURSABLE_AT_RULES.has(rule.type))
			checkRules(
				rule.value?.rules ?? [],
				tag,
				scope,
				styleDepth,
				parents,
				lineStarts,
				findings,
			)
	}
}

/**
 * Check a parsed component stylesheet against the authored `@scope` form
 * (ADR 0033 s6): a rule inside `@scope` led by the component's own tag
 * (fix-it: `:where(:scope)`), `:host` anywhere (fix-it: `:where(:scope)`), `::slotted()`
 * in a light-DOM component, `:host-context()` anywhere, `:global` anywhere
 * and a selector an authored limit always excludes. Runs over
 * lightningcss's read-only parse — the sheet syntax is already LTC064's, so
 * every shape here parsed clean. Offsets resolve against the sheet text
 * lightningcss parsed.
 */
export const checkSheetContract = (
	sheet: unknown,
	sheetText: string,
	tag: string,
): ContractFinding[] => {
	const findings: ContractFinding[] = []
	checkRules(
		(sheet as { rules?: LcRule[] })?.rules ?? [],
		tag.toLowerCase(),
		null,
		0,
		null,
		lineStartsOf(sheetText),
		findings,
	)
	return findings.map(finding => withSelectorEnd(sheetText, finding))
}

/* === Forms the lowering cannot express (ADR 0033 s4, LTC089) === */

const hasScopeReference = (selector: LcSelector): boolean => {
	let found = false
	forEachComponent(selector, component => {
		if (
			component.type === 'nesting' ||
			(component.type === 'pseudo-class' && component.kind === 'scope')
		)
			found = true
	})
	return found
}

const checkLoweringRules = (
	rules: readonly LcRule[],
	inScope: boolean,
	lineStarts: readonly number[],
	findings: LoweringFinding[],
): void => {
	for (const rule of rules) {
		if (rule.type === 'scope') {
			const offset = rule.value?.loc
				? locToOffset(lineStarts, rule.value.loc)
				: undefined
			if (inScope) findings.push({ face: 'nested-scope', offset })
			else if ((rule.value?.scopeEnd ?? []).some(hasScopeReference))
				findings.push({ face: 'scope-in-limit', offset })
			checkLoweringRules(rule.value?.rules ?? [], true, lineStarts, findings)
			continue
		}
		if (rule.type === 'style' || RECURSABLE_AT_RULES.has(rule.type))
			checkLoweringRules(rule.value?.rules ?? [], inScope, lineStarts, findings)
	}
}

/**
 * The `@scope` forms the lowered emission cannot express (ADR 0033 s4): a
 * `@scope` inside a component `@scope`, and a limit that names `:scope`.
 * Only a lowered target fails on them — a native target ships the same
 * sheet verbatim, so the caller runs this check for `scopeModeOf(targets)
 * === 'lowered'` alone.
 */
export const checkSheetLowering = (
	sheet: unknown,
	sheetText: string,
): LoweringFinding[] => {
	const findings: LoweringFinding[] = []
	checkLoweringRules(
		(sheet as { rules?: LcRule[] })?.rules ?? [],
		false,
		lineStartsOf(sheetText),
		findings,
	)
	return findings.map(finding => {
		if (finding.offset === undefined) return finding
		// The range is the `@scope` prelude, up to its block.
		const brace = sheetText.indexOf('{', finding.offset)
		if (brace < 0) return finding
		let end = brace
		while (end > finding.offset && /\s/.test(sheetText[end - 1] ?? '')) end--
		return { ...finding, end }
	})
}

/* === Text scanning (the surgery never parses selectors) === */

/** First index at/after `from` of `ch` outside strings and comments; -1 if none. */
const indexOfUnquoted = (text: string, ch: string, from: number): number => {
	let i = from
	while (i < text.length) {
		const c = text[i]
		if (c === '"' || c === "'") {
			const quote = c
			i++
			while (i < text.length && text[i] !== quote) {
				if (text[i] === '\\') i++
				i++
			}
		} else if (c === '/' && text[i + 1] === '*') {
			const end = text.indexOf('*/', i + 2)
			if (end === -1) return -1
			i = end + 1
			continue
		} else if (c === ch) return i
		i++
	}
	return -1
}

/** Index of the `)` matching the `(` at `open`, strings and comments aside. */
const matchingParen = (text: string, open: number): number => {
	let depth = 0
	let i = open
	while (i < text.length) {
		const c = text[i]
		if (c === '"' || c === "'") {
			const quote = c
			i++
			while (i < text.length && text[i] !== quote) {
				if (text[i] === '\\') i++
				i++
			}
		} else if (c === '/' && text[i + 1] === '*') {
			const end = text.indexOf('*/', i + 2)
			if (end === -1) return -1
			i = end + 1
			continue
		} else if (c === '(') depth++
		else if (c === ')') {
			depth--
			if (depth === 0) return i
		}
		i++
	}
	return -1
}

/** Offset of the `}` closing the `{` at `openBrace`, -1 when unbalanced. */
const matchingBrace = (text: string, openBrace: number): number => {
	let depth = 0
	let i = openBrace
	while (i < text.length) {
		const c = text[i]
		if (c === '"' || c === "'") {
			const quote = c
			i++
			while (i < text.length && text[i] !== quote) {
				if (text[i] === '\\') i++
				i++
			}
		} else if (c === '/' && text[i + 1] === '*') {
			const end = text.indexOf('*/', i + 2)
			if (end === -1) return -1
			i = end + 1
			continue
		} else if (c === '{') depth++
		else if (c === '}') {
			depth--
			if (depth === 0) return i
		}
		i++
	}
	return -1
}

const skipSpaceAndComments = (text: string, from: number): number => {
	let i = from
	for (;;) {
		while (i < text.length && /\s/.test(text[i] as string)) i++
		if (text.startsWith('/*', i)) {
			const end = text.indexOf('*/', i + 2)
			i = end === -1 ? text.length : end + 2
			continue
		}
		return i
	}
}

/** One rule located in a stylesheet text: `[start, end)`, `{` at `brace`. */
type TextRule = { start: number; end: number; brace: number }

/**
 * The rules at ONE nesting level of a stylesheet text range, comments and
 * strings accounted for. Blockless statements (`@layer a, b;`) are no rule
 * and must not swallow the selector of the next one (LT-398).
 */
const scanRules = (text: string, from: number, to: number): TextRule[] => {
	const out: TextRule[] = []
	let i = skipSpaceAndComments(text, from)
	while (i < to) {
		if (i >= text.length || text[i] === '}') break
		const brace = indexOfUnquoted(text, '{', i)
		const semicolon = indexOfUnquoted(text, ';', i)
		if (
			semicolon !== -1 &&
			semicolon < to &&
			(brace === -1 || semicolon < brace)
		) {
			i = skipSpaceAndComments(text, semicolon + 1)
			continue
		}
		if (brace === -1 || brace >= to) break
		const close = matchingBrace(text, brace)
		if (close === -1 || close >= to) break
		out.push({ start: i, end: close + 1, brace })
		i = skipSpaceAndComments(text, close + 1)
	}
	return out
}

/** The at-rule name of a text rule, or null for a style rule. */
const atRuleName = (text: string, rule: TextRule): string | null => {
	if (text[rule.start] !== '@') return null
	const match = /^@([a-zA-Z-]+)/.exec(text.slice(rule.start, rule.brace))
	return match?.[1] ?? null
}

/** Conditional groups, whose blocks hold rules the emission descends into. */
const CONDITIONAL_AT_RULES = new Set([
	'media',
	'supports',
	'container',
	'layer',
	'starting-style',
])

/** Commas outside parens/brackets/strings — a selector list's separators. */
const splitTopLevelCommas = (selectorText: string): string[] => {
	const parts: string[] = []
	let depth = 0
	let start = 0
	let i = 0
	while (i < selectorText.length) {
		const c = selectorText[i]
		if (c === '"' || c === "'") {
			const quote = c
			i++
			while (i < selectorText.length && selectorText[i] !== quote) {
				if (selectorText[i] === '\\') i++
				i++
			}
		} else if (c === '(' || c === '[') depth++
		else if (c === ')' || c === ']') depth--
		else if (c === ',' && depth === 0) {
			parts.push(selectorText.slice(start, i))
			start = i + 1
		}
		i++
	}
	parts.push(selectorText.slice(start))
	return parts
}

/** Apply `{offset, from, to}` splices in one reverse pass. */
const splice = (
	text: string,
	replacements: Array<{ start: number; end: number; text: string }>,
): string => {
	let out = text
	for (const { start, end, text: replacement } of [...replacements].sort(
		(a, b) => b.start - a.start,
	))
		out = out.slice(0, start) + replacement + out.slice(end)
	return out
}

/* === Relative selectors at the top of a `@scope` block === */

/**
 * The selector anchor written before a relative selector (`> p`) at the
 * top of a `@scope` block. lightningcss 1.33 refuses a relative selector
 * there ("Invalid empty selector") although the platform accepts it, so
 * every parse and transform reads an anchored copy:
 *
 * - `'&'` for the read-only parse the checks run over. It stands for the
 *   scope root there, and where whitespace precedes the combinator it
 *   REPLACES that character, so every parsed loc still resolves against
 *   the authored text;
 * - `':where(:scope)'` for the lowered emission's flattening pass — the
 *   implicit `:scope` of a relative selector, whose specificity is zero.
 *   (lightningcss flattens a top-level `&` into `:scope`, which counts.)
 *
 * The native emission ships the authored text, relative selectors and all.
 */
export type RelativeAnchor = '&' | ':where(:scope)'

/** Edits that anchor each relative member of one selector list. */
const anchorList = (
	text: string,
	start: number,
	end: number,
	anchor: RelativeAnchor,
	edits: Array<{ start: number; end: number; text: string }>,
): void => {
	let member = start
	for (const part of splitTopLevelCommas(text.slice(start, end))) {
		const at = skipSpaceAndComments(text, member)
		const c = text[at]
		if (at < member + part.length && (c === '>' || c === '+' || c === '~')) {
			const before = text[at - 1]
			if (anchor === '&' && (before === ' ' || before === '\t'))
				edits.push({ start: at - 1, end: at, text: '&' })
			else
				edits.push({
					start: at,
					end: at,
					text: anchor === '&' ? '&' : `${anchor} `,
				})
		}
		member += part.length + 1
	}
}

const anchorRules = (
	text: string,
	from: number,
	to: number,
	inScope: boolean,
	anchor: RelativeAnchor,
	edits: Array<{ start: number; end: number; text: string }>,
): void => {
	for (const rule of scanRules(text, from, to)) {
		const name = atRuleName(text, rule)
		if (name === null) {
			if (inScope) anchorList(text, rule.start, rule.brace, anchor, edits)
		} else if (name === 'scope' || CONDITIONAL_AT_RULES.has(name))
			anchorRules(
				text,
				rule.brace + 1,
				rule.end - 1,
				inScope || name === 'scope',
				anchor,
				edits,
			)
	}
}

/**
 * The sheet text with every relative selector at the top of a `@scope`
 * block anchored (see `RelativeAnchor`). Nested rules need no anchor:
 * lightningcss reads `> p` inside a style rule as nesting.
 */
export const anchorRelativeSelectors = (
	text: string,
	anchor: RelativeAnchor,
): string => {
	const edits: Array<{ start: number; end: number; text: string }> = []
	anchorRules(text, 0, text.length, false, anchor, edits)
	return edits.length === 0 ? text : splice(text, edits)
}

/* === The scope block's prelude === */

/**
 * A component `@scope` block as the emission reads it from its text: the
 * prelude (`(<root>)`, absent for the host) and the authored limits.
 */
type ScopeHead = {
	/** The text between `@scope` and `{`, trimmed. */
	text: string
	/** The authored root selector, or null when the block is prelude-less. */
	root: string | null
	/** The authored limits, one per member of `to (…)`. */
	limits: string[]
}

const scopeHeadOf = (head: string): ScopeHead => {
	let rest = head.trim()
	const text = rest
	let root: string | null = null
	if (rest.startsWith('(')) {
		const close = matchingParen(rest, 0)
		if (close !== -1) {
			root = rest.slice(1, close).trim()
			rest = rest.slice(close + 1).trim()
		}
	}
	const limits: string[] = []
	if (/^to\s*\(/.test(rest)) {
		const open = rest.indexOf('(')
		const close = matchingParen(rest, open)
		if (close !== -1)
			for (const member of splitTopLevelCommas(rest.slice(open + 1, close)))
				if (member.trim() !== '') limits.push(member.trim())
	}
	return { text, root, limits }
}

/* === Native emission === */

/**
 * Walk a canonical sheet's rules, giving every component `@scope` its
 * explicit root (ADR 0033 s3). A conditional group can hold a `@scope`;
 * everything inside a `@scope` — nested blocks included — stays verbatim.
 */
const nativeRules = (
	text: string,
	from: number,
	to: number,
	tag: string,
): string => {
	let out = ''
	let cursor = from
	for (const rule of scanRules(text, from, to)) {
		out += text.slice(cursor, rule.start)
		cursor = rule.end
		const name = atRuleName(text, rule)
		if (name === 'scope') {
			const head = text.slice(rule.start + '@scope'.length, rule.brace).trim()
			const body = text.slice(rule.brace, rule.end)
			if (head === '') out += `@scope (${tag}) ${body}`
			else if (/^to\s*\(/.test(head)) out += `@scope (${tag}) ${head} ${body}`
			else out += text.slice(rule.start, rule.end)
		} else if (name !== null && CONDITIONAL_AT_RULES.has(name)) {
			out += `${text.slice(rule.start, rule.brace + 1)}${nativeRules(
				text,
				rule.brace + 1,
				rule.end - 1,
				tag,
			)}}`
		} else out += text.slice(rule.start, rule.end)
	}
	return out + text.slice(cursor, to)
}

/* === Lowered emission === */

/**
 * The never-present attribute inside `:not()` that gives the root compound
 * the (0,1,0) specificity of `:scope`, on top of the zero-specificity
 * `:where(<root>)`. The compound still matches the host: the attribute is
 * not one any element carries.
 */
const SCOPE_PAD = ':not([data-truc-scope-pad])'

/** What lowering one component `@scope` block needs. */
type LoweringScope = {
	/** The root compound: `:where(<root>)` plus the specificity pad. */
	rootCompound: string
	/** The bare root as a leading `:where()`. */
	lead: string
	/** The guards, one per authored limit, ready to splice. */
	guards: string
}

const loweringScopeOf = (head: ScopeHead, tag: string): LoweringScope => {
	const root = head.root ?? tag
	const listed = splitTopLevelCommas(root).length > 1 ? `:is(${root})` : root
	// The re-include (ADR 0033 s4): an own-tag instance below the limit, or
	// one the limit itself matches, is a scope root of its own, and so is
	// everything inside it.
	const guard = (limit: string): string =>
		`:where(:not(:is(${listed} ${limit}, ${listed} ${limit} *):not(${listed} ${limit} ${tag}, ${listed} ${limit} ${tag} *, ${listed} ${limit}:is(${tag}), ${listed} ${limit}:is(${tag}) *)))`
	return {
		rootCompound: `:where(${root})${SCOPE_PAD}`,
		lead: `:where(${root})`,
		guards: head.limits.map(guard).join(''),
	}
}

/** The four CSS2.1 pseudo-elements, which also have a single-colon spelling. */
const LEGACY_PSEUDO_ELEMENT =
	/^:(?:before|after|first-line|first-letter)(?![\w-])/

/**
 * Where a flat complex selector's subject compound starts, and where the
 * guard goes: before the first pseudo-element of the subject (`::before`,
 * legacy `:before`, `::part(x)`, `::-webkit-scrollbar-thumb`), else at the
 * end. `:where()` cannot follow a pseudo-element — only user-action
 * pseudo-classes may (`::part(x):hover`) — so the guard anchors on the
 * originating element, which constrains the same element (LT-398).
 */
const subjectOf = (selector: string): { subject: number; guard: number } => {
	let depth = 0
	let subject = 0
	for (let i = 0; i < selector.length; i++) {
		const c = selector[i] as string
		if (c === '"' || c === "'") {
			const quote = c
			i++
			while (i < selector.length && selector[i] !== quote) {
				if (selector[i] === '\\') i++
				i++
			}
		} else if (c === '(' || c === '[') depth++
		else if (c === ')' || c === ']') depth--
		else if (depth === 0 && /[\s>+~]/.test(c)) subject = i + 1
	}
	depth = 0
	for (let i = subject; i < selector.length; i++) {
		const c = selector[i] as string
		if (c === '(' || c === '[') depth++
		else if (c === ')' || c === ']') depth--
		else if (depth === 0 && c === ':') {
			if (selector[i + 1] === ':') return { subject, guard: i }
			if (LEGACY_PSEUDO_ELEMENT.test(selector.slice(i)))
				return { subject, guard: i }
		}
	}
	return { subject, guard: selector.trimEnd().length }
}

const SCOPE_PSEUDO = /:scope(?![\w-])/
const SCOPE_PSEUDO_ALL = /:scope(?![\w-])/g
const WHERE_SCOPE = /:where\(\s*:scope\s*\)/g

/** Whether a compound text holds `:scope` outside any parentheses. */
const hasTopLevelScope = (compound: string): boolean => {
	let depth = 0
	for (let i = 0; i < compound.length; i++) {
		const c = compound[i] as string
		if (c === '(' || c === '[') depth++
		else if (c === ')' || c === ']') depth--
		else if (
			depth === 0 &&
			c === ':' &&
			/^:scope(?![\w-])/.test(compound.slice(i))
		)
			return true
	}
	return false
}

/**
 * Rewrite one flat complex selector of a component `@scope` block. An
 * explicit `:scope` becomes the root compound and the selector needs no
 * lead; any other selector leads with `:where(<root>)`, the implicit
 * descendant prefix. The limits' guards close the subject — except where
 * the subject IS the root, which no limit can exclude.
 */
const lowerSelector = (selector: string, scope: LoweringScope): string => {
	const member = selector.trim()
	// `:where(:scope)` — the authored way to a zero-specificity host rule —
	// is the bare root lead; every other `:scope` is the padded compound.
	const plain = member.replace(WHERE_SCOPE, () => scope.lead)
	const rootSubject = hasTopLevelScope(
		member.replace(WHERE_SCOPE, ':scope').slice(subjectOf(member).subject),
	)
	const explicit = SCOPE_PSEUDO.test(plain) || plain !== member
	const rewritten = explicit
		? plain.replace(SCOPE_PSEUDO_ALL, () => scope.rootCompound)
		: `${scope.lead} ${member}`
	if (rootSubject || scope.guards === '') return rewritten
	const at = subjectOf(rewritten).guard
	return `${rewritten.slice(0, at)}${scope.guards}${rewritten.slice(at)}`
}

const lowerSelectorList = (list: string, scope: LoweringScope): string =>
	splitTopLevelCommas(list)
		.map(member => lowerSelector(member, scope))
		.join(', ')

/**
 * Lower the rules of a flattened sheet range. Outside a component
 * `@scope`, rules stay verbatim; a component `@scope` unwraps into its
 * lowered rules; conditional groups are entered to reach a `@scope` or to
 * lower the rules of one.
 */
const lowerRules = (
	text: string,
	from: number,
	to: number,
	tag: string,
	scope: LoweringScope | null,
): string => {
	let out = ''
	let cursor = from
	for (const rule of scanRules(text, from, to)) {
		out += text.slice(cursor, rule.start)
		cursor = rule.end
		const name = atRuleName(text, rule)
		if (name === null) {
			out += scope
				? `${lowerSelectorList(text.slice(rule.start, rule.brace), scope)} ${text.slice(rule.brace, rule.end)}`
				: text.slice(rule.start, rule.end)
		} else if (name === 'scope' && scope === null) {
			const head = scopeHeadOf(
				text.slice(rule.start + '@scope'.length, rule.brace),
			)
			const body = lowerRules(
				text,
				rule.brace + 1,
				rule.end - 1,
				tag,
				loweringScopeOf(head, tag),
			)
			// The block's rules sat one indentation step in.
			out += body.replace(/^ {1,2}/gm, '').trim()
		} else if (CONDITIONAL_AT_RULES.has(name)) {
			out += `${text.slice(rule.start, rule.brace + 1)}${lowerRules(
				text,
				rule.brace + 1,
				rule.end - 1,
				tag,
				scope,
			)}}`
		} else out += text.slice(rule.start, rule.end)
	}
	return out + text.slice(cursor, to)
}

/* === The partition === */

/**
 * Partition of the authored sheet for the lowered emission: verbatim
 * fragments hoisted out of the flattening, and the remainder's text spans.
 */
type Fragment = { start: number; end: number }

const HOISTED_AT_RULES = new Set([
	'keyframes',
	'import',
	'namespace',
	'font-face',
	'property',
	'counter-style',
	'font-palette-values',
	'font-feature-values',
	'page',
	'view-transition',
	'color-profile',
])

/**
 * Top-level partition of the authored sheet, over the parsed rules' locs:
 * `@keyframes`/`@font-face`/`@property` and the other hoisted at-rules
 * become fragments; everything else stays in the remainder.
 */
const partitionSheet = (
	sheet: unknown,
	sheetText: string,
): { canonical: string; fragments: Fragment[] } => {
	const fragments: Fragment[] = []
	const { text: canonical, strip } = dedentWithStrips(sheetText)
	const rules = (sheet as { rules?: LcRule[] })?.rules ?? []
	const lineStarts = lineStartsOf(canonical)
	const bounds: number[] = rules.map(rule =>
		rule.value?.loc ? shiftedLocToOffset(lineStarts, strip, rule.value.loc) : 0,
	)
	for (const [index, rule] of rules.entries()) {
		if (!HOISTED_AT_RULES.has(rule.type)) continue
		fragments.push({
			start: bounds[index] as number,
			end: (bounds[index + 1] as number | undefined) ?? canonical.length,
		})
	}
	return { canonical, fragments }
}

/* === The emission === */

/**
 * Emit the component stylesheet (ADR 0033 s3/s4). Native: the canonical
 * (dedented) sheet with the explicit root on every prelude-less component
 * `@scope`. Lowered: the hoisted at-rules verbatim, then the remainder
 * flattened through a plain lightningcss `transform` (never the visitor
 * write path — see the module doc) and lowered block by block.
 */
export const emitScopedSheet = (
	sheet: unknown,
	sheetText: string,
	tag: string,
	cssTargets: CssTargets,
): string => {
	if (scopeModeOf(cssTargets) === 'native') {
		const { text } = dedentWithStrips(sheetText)
		const emitted = nativeRules(text, 0, text.length, tag).trim()
		return emitted === '' ? '' : `${emitted}\n`
	}

	const { canonical, fragments } = partitionSheet(sheet, sheetText)
	const hoisted = fragments
		.map(fragment => canonical.slice(fragment.start, fragment.end).trim())
		.filter(fragment => fragment !== '')

	// The remainder: the canonical sheet with every hoisted fragment's span
	// removed, separators and all — lightningcss reformats what it re-emits.
	const remainder = anchorRelativeSelectors(
		splice(
			canonical,
			fragments.map(fragment => ({ ...fragment, text: '' })),
		),
		':where(:scope)',
	)
	let lowered = ''
	if (remainder.trim() !== '') {
		const flat = new TextDecoder()
			.decode(
				transform({
					code: Buffer.from(remainder) as Buffer,
					filename: 'scoped.css',
					...flatteningTargets(cssTargets),
				}).code,
			)
			.trim()
		lowered = lowerRules(flat, 0, flat.length, tag, null)
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	}

	const parts = [...hoisted, ...(lowered !== '' ? [lowered] : [])]
	return parts.length > 0 ? `${parts.join('\n\n')}\n` : ''
}
