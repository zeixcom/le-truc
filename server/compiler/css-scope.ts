/**
 * Scoped emission of shadow-root-form CSS (ADR 0033 s1–s7, LT-304).
 *
 * A compiled sheet is authored as shadow-root CSS — `:host` for the host
 * element, bare selectors for the internals — and the compiler gives it
 * shadow-root scoping in light DOM, rules stopping at every custom element
 * the template renders. Native `@scope` where the CSS target supports it,
 * a flat-selector lowering where not; the boundary is every custom-element
 * tag the lowered template renders, composed and raw dashed tags alike.
 *
 * EMISSION STRATEGY (the LT-268 review hazard): the lightningcss 1.33
 * WRITE path — returning nodes from a visitor — crashes with
 * "failed to deserialize … Specifier" whenever a nested rule's declaration
 * holds `var()` (upstream parcel-bundler/lightningcss#1065, tracked with
 * #1081; the read-only and plain-`transform` directions are unaffected).
 * Scoped emission therefore never returns nodes: the sheet is partitioned
 * at the TEXT level over lightningcss's read-only parse, the scoped
 * remainder is flattened through a plain `transform()` (Rust→JS only, the
 * direction every plain build already exercises) so nesting never reaches
 * the surgery, and every selector rewrite is a string splice — the checks
 * read lightningcss's deserialized selector components, the emission never
 * parses selectors at all. Bumping lightningcss must re-probe the plain
 * path with `var()` in nested rules before any visitor-based emission is
 * considered.
 *
 * The flattening pass runs with the configured targets CAPPED just below
 * native nesting support (ADR 0033 s4: the lowered emission is flat
 * selectors). Everything else lowers only as far as the real targets
 * demand — the default (Baseline widely available) keeps every
 * Baseline-2023 feature authored. `:where()` and complex `:not()` — the
 * lowering's own vocabulary — are Baseline 2021, within the runtime's
 * baseline, so the guard never needs lowering.
 *
 * `@keyframes`/`@font-face`/`@property` and the two whole-rule `:global`
 * forms hoist out of the scope verbatim (ADR 0033 s3/s6a); the `:global`
 * wrapper itself is authored-side vocabulary and unwraps on emission.
 */

import { Features, transform } from 'lightningcss-wasm'
import { CSS_BROWSERS, type CssBrowser, type CssTargets } from './emit-paths'
import type { TemplateNode } from './ir'
import type { RegistryEntry } from './registry'
import { walkTemplate } from './walk'

/* === Types === */

/** How the sheet is scoped: native `@scope` or the flat-selector lowering. */
export type ScopeMode = 'native' | 'lowered'

/** The authored forms with no meaning under the shadow-root contract. */
export type ContractFace =
	/** A rule led by the component's own tag (fix-it: `:host`). */
	| 'own-tag-led'
	/** `::slotted()` in a light-DOM component. */
	| 'slotted'
	/** `:host-context()` anywhere (removed from the spec). */
	| 'host-context'
	/** `:host` directly qualified (`:host.x`) — matches nothing in a shadow root. */
	| 'host-qualifier'
	/** `:global` in a form other than the two whole-rule forms. */
	| 'global'

/** Why a `:global` use is not one of the two whole-rule forms (ADR 0033 s6a). */
export type GlobalFace =
	| 'nested'
	| 'prefixed'
	| 'trailing'
	| 'leading-ancestor'
	| 'mid-selector'
	| 'declarations'

/** One authored-form finding over the sheet (ADR 0033 s6). */
export type ContractFinding = {
	face: ContractFace
	/** For the `global` face: which misuse. */
	globalFace?: GlobalFace
	/** The offending selector, summarized, for the message body. */
	selector: string
	/** 0-based offset within the sheet text, when known. */
	offset?: number
}

/* === Deserialized lightningcss shapes (read structurally, never written) === */

type LcComponent = {
	type: string
	name?: string
	kind?: string
	value?: string
}
type LcSelector = LcComponent[]
type LcDeclarations = {
	declarations?: unknown[]
	importantDeclarations?: unknown[]
}
type LcRule = {
	type: string
	value?: {
		selectors?: LcSelector[]
		declarations?: LcDeclarations
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
 * Packed targets just below native nesting support (Chrome/Edge 112,
 * Firefox 117, Safari 16.5). The flattening pass caps every configured
 * browser here and FILLS every missing one from the same cap — nesting
 * always lowers (ADR 0033 s4: the emitted sheet is flat), whatever the
 * target names.
 */
const NESTING_CAP: Record<CssBrowser, number> = {
	chrome: (112 << 16) - 1,
	edge: (112 << 16) - 1,
	firefox: (117 << 16) - 1,
	safari: ((16 << 16) | (5 << 8)) - 1,
}

/**
 * The flattening pass's transform options: the capped targets, with
 * `light-dark()` EXCLUDED from lowering. Nesting is strictly older than
 * `light-dark()`, so the caps would lower both — and the `light-dark()`
 * lowering rewrites a declaration into `var(--lightningcss-light, …)
 * var(--lightningcss-dark, …)`, a two-value background that is invalid at
 * computed-value time. Authored `light-dark()` ships and the page bundle's
 * own lowering (with its companion definitions) handles it.
 */
const flatteningTargets = (
	targets: CssTargets,
): { targets: Record<string, number>; exclude: number } => {
	const capped: Record<string, number> = {}
	for (const browser of CSS_BROWSERS)
		capped[browser] = Math.min(
			targets[browser] ?? NESTING_CAP[browser],
			NESTING_CAP[browser],
		)
	return { targets: capped, exclude: Features.LightDark }
}

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

const isGlobalPseudo = (component: LcComponent): boolean =>
	component.type === 'pseudo-class' &&
	(component.kind === 'custom' || component.kind === 'custom-function') &&
	component.name === 'global'

/**
 * A selector that is EXACTLY `:global` — with the whole selector in its
 * parentheses (the whole-rule form, `custom-function`) or bare (the block
 * form, `custom`). Either shape is legal at the sheet's top level.
 */
const isWholeGlobalSelector = (selector: LcSelector): boolean =>
	selector.length === 1 && isGlobalPseudo(selector[0] as LcComponent)

/** Why a selector's `:global` sits where it sits (ADR 0033 s6a). */
const globalFaceOf = (selector: LcSelector): GlobalFace => {
	const index = selector.findIndex(isGlobalPseudo)
	const last = selector.length - 1
	if (index === 0) {
		if (selector.length === 1) return 'prefixed' // legal shape in a mixed list
		const next = selector[1] as LcComponent
		return next.type === 'combinator' ? 'leading-ancestor' : 'prefixed'
	}
	if (index === last) return 'trailing'
	return 'mid-selector'
}

/** The deserialized selector's authored text is not carried — summarize it. */
const selectorTextOf = (selector: LcSelector): string =>
	selector
		.map(component => {
			if (component.type === 'combinator')
				return component.value === 'descendant' ? ' ' : ` ${component.value} `
			if (component.type === 'nesting') return '&'
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

const checkRules = (
	rules: readonly LcRule[],
	tag: string,
	depth: number,
	lineStarts: readonly number[],
	findings: ContractFinding[],
): void => {
	for (const rule of rules) {
		if (rule.type === 'style') {
			const value = rule.value
			const selectors = value?.selectors ?? []
			const offset = value?.loc ? locToOffset(lineStarts, value.loc) : undefined
			for (const selector of selectors) {
				const first = selector[0] as LcComponent | undefined
				if (
					depth === 0 &&
					first?.type === 'type' &&
					first.name?.toLowerCase() === tag
				)
					findings.push({
						face: 'own-tag-led',
						selector: selectorTextOf(selector),
						offset,
					})
				for (const [index, component] of selector.entries()) {
					if (
						component.type === 'pseudo-element' &&
						component.kind === 'slotted'
					)
						findings.push({
							face: 'slotted',
							selector: selectorTextOf(selector),
							offset,
						})
					if (
						component.type === 'pseudo-class' &&
						component.kind === 'custom-function' &&
						component.name === 'host-context'
					)
						findings.push({
							face: 'host-context',
							selector: selectorTextOf(selector),
							offset,
						})
					// R3 (owner, 2026-10-02): `:host` followed directly by a
					// qualifier — `:host.x`, `:host:hover`, `:host[attr]` —
					// matches nothing in a shadow root; the qualifier belongs
					// in the arguments (`:host(<qualifier>)`).
					if (
						component.type === 'pseudo-class' &&
						component.kind === 'host' &&
						index < selector.length - 1
					) {
						const next = selector[index + 1] as LcComponent
						const qualified =
							next.type === 'class' ||
							next.type === 'attribute' ||
							(next.type === 'pseudo-class' && next.kind !== 'host')
						if (qualified)
							findings.push({
								face: 'host-qualifier',
								selector: selectorTextOf(selector),
								offset,
							})
					}
				}
			}
			const hasGlobal = selectors.some(selectorsOf =>
				selectorsOf.some(isGlobalPseudo),
			)
			if (hasGlobal) {
				if (depth > 0) {
					findings.push({
						face: 'global',
						globalFace: 'nested',
						selector: selectorTextOf((selectors[0] as LcSelector) ?? []),
						offset,
					})
				} else if (!selectors.every(isWholeGlobalSelector)) {
					const offender =
						(selectors as LcSelector[]).find(selectorsOf =>
							selectorsOf.some(isGlobalPseudo),
						) ?? (selectors[0] as LcSelector)
					findings.push({
						face: 'global',
						globalFace: globalFaceOf(offender),
						selector: selectorTextOf(offender),
						offset,
					})
				} else {
					const bare = (selectors[0] as LcSelector)[0]?.kind === 'custom'
					const declarationCount =
						(value?.declarations?.declarations?.length ?? 0) +
						(value?.declarations?.importantDeclarations?.length ?? 0)
					if (bare && declarationCount > 0)
						findings.push({
							face: 'global',
							globalFace: 'declarations',
							selector: ':global',
							offset,
						})
				}
			}
			checkRules(value?.rules ?? [], tag, depth + 1, lineStarts, findings)
			continue
		}
		if (RECURSABLE_AT_RULES.has(rule.type))
			checkRules(rule.value?.rules ?? [], tag, depth + 1, lineStarts, findings)
	}
}

/**
 * Check a parsed component stylesheet against the shadow-root authored
 * form (ADR 0033 s6, LT-304): a rule led by the component's own tag
 * (fix-it: `:host`), `::slotted()` in a light-DOM component,
 * `:host-context()` anywhere, and every `:global` form except the two
 * top-level whole-rule forms. Runs over lightningcss's read-only parse —
 * the sheet syntax is already LTC064's, so every shape here parsed clean.
 * Offsets resolve against the sheet text lightningcss parsed.
 */
export const checkSheetContract = (
	sheet: unknown,
	sheetText: string,
	tag: string,
): ContractFinding[] => {
	const findings: ContractFinding[] = []
	const lineStarts = lineStartsOf(sheetText)
	checkRules(
		(sheet as { rules?: LcRule[] })?.rules ?? [],
		tag.toLowerCase(),
		0,
		lineStarts,
		findings,
	)
	return findings
}

/* === The boundary === */

/**
 * Every custom-element tag the lowered template renders (ADR 0033 s3):
 * raw dashed tags and composed children alike, document order, deduplicated
 * keep-first. The walk stops at compose nodes — the child's internals are
 * the child's own business — and a self-nested component's own tag belongs
 * in the list like any other. Page-authored children (`{children}` holes)
 * are NOT boundaries: the component's rules style them (ADR 0033 s7).
 */
export const collectScopeBoundaries = (
	root: TemplateNode & { kind: 'element' },
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
): string[] => {
	const tags: string[] = []
	const seen = new Set<string>()
	const push = (tag: string | undefined): void => {
		if (!tag || !tag.includes('-') || seen.has(tag)) return
		seen.add(tag)
		tags.push(tag)
	}
	walkTemplate(
		root,
		(node, parent) => {
			// The scope root itself is not a boundary — only what it renders
			// (a self-nested instance arrives as a child, parent non-null).
			if (parent === null) return
			if (node.kind === 'element') push(node.tag)
			if (node.kind === 'compose') push(composeRegistry?.get(node.source)?.tag)
		},
		{ intoCompose: false },
	)
	return tags
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
 * Every rule in a stylesheet text, depth-first, comments and strings
 * accounted for. At-rule blocks are recursed only for the recursable
 * names — `@keyframes` descriptors and keyframe selectors are never
 * component selectors. `isAtRule` distinguishes the two.
 */
const collectTextRules = (
	text: string,
	from: number,
	to: number,
	out: TextRule[],
): void => {
	let i = skipSpaceAndComments(text, from)
	while (i < to) {
		if (i >= text.length || text[i] === '}') break
		const brace = indexOfUnquoted(text, '{', i)
		if (brace === -1 || brace >= to) break
		const close = matchingBrace(text, brace)
		if (close === -1 || close >= to) break
		const rule: TextRule = { start: i, end: close + 1, brace }
		out.push(rule)
		const name = atRuleName(text, rule)
		const recursable =
			name !== null &&
			[
				'media',
				'supports',
				'container',
				'layer',
				'starting-style',
				'scope',
			].includes(name)
		if (recursable) collectTextRules(text, brace + 1, close, out)
		i = skipSpaceAndComments(text, close + 1)
	}
}

/** The at-rule name of a text rule, or null for a style rule. */
const atRuleName = (text: string, rule: TextRule): string | null => {
	if (text[rule.start] !== '@') return null
	const match = /^@([a-zA-Z-]+)/.exec(text.slice(rule.start, rule.brace))
	return match?.[1] ?? null
}

/* === The emission === */

/**
 * Partition of the authored sheet: verbatim fragments hoisted out of the
 * scope, and the scoped remainder's text span.
 */
type Fragment = {
	kind: 'verbatim' | 'global-whole' | 'global-block'
	start: number
	end: number
}

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
 * `@keyframes`/`@font-face`/`@property` and the two whole-rule `:global`
 * forms become fragments; everything else stays in the scoped remainder.
 * Fragment/global-block CONTENT extraction happens at emission from the
 * authored text spans.
 */
const partitionSheet = (
	sheet: unknown,
	sheetText: string,
): {
	canonical: string
	fragments: Fragment[]
	scopedSpans: Array<[number, number]>
} => {
	const fragments: Fragment[] = []
	const scopedSpans: Array<[number, number]> = []
	const { text: canonical, strip } = dedentWithStrips(sheetText)
	const rules = (sheet as { rules?: LcRule[] })?.rules ?? []
	const lineStarts = lineStartsOf(canonical)
	const bounds: number[] = rules.map(rule =>
		rule.value?.loc ? shiftedLocToOffset(lineStarts, strip, rule.value.loc) : 0,
	)
	for (const [index, rule] of rules.entries()) {
		const start = bounds[index] as number
		const end = (bounds[index + 1] as number | undefined) ?? canonical.length
		if (HOISTED_AT_RULES.has(rule.type)) {
			fragments.push({ kind: 'verbatim', start, end })
			continue
		}
		if (rule.type === 'style') {
			const selectors = rule.value?.selectors ?? []
			if (selectors.length > 0 && selectors.every(isWholeGlobalSelector)) {
				const only = selectors[0] as LcSelector
				fragments.push({
					kind: only[0]?.kind === 'custom' ? 'global-block' : 'global-whole',
					start,
					end,
				})
				continue
			}
		}
		scopedSpans.push([start, end])
	}
	return { canonical, fragments, scopedSpans }
}

/**
 * The emitted text of one hoisted fragment: hoisted at-rules and the
 * `:global` wrapper's unwrap (ADR 0033 s6a — the wrapper is authored-side
 * vocabulary; the rule itself ships outside the scope as written).
 */
const fragmentText = (fragment: Fragment, sheetText: string): string => {
	const text = sheetText.slice(fragment.start, fragment.end)
	if (fragment.kind === 'verbatim' || fragment.kind === 'global-block') {
		if (fragment.kind === 'global-block') {
			const brace = indexOfUnquoted(text, '{', 0)
			const close = matchingBrace(text, brace)
			if (brace !== -1 && close !== -1) return text.slice(brace + 1, close)
		}
		return text
	}
	// `:global(<selector>) { … }` → `<selector> { … }`
	const paren = indexOfUnquoted(text, '(', 0)
	const closeParen = matchingParen(text, paren)
	const brace = indexOfUnquoted(text, '{', closeParen + 1)
	if (paren === -1 || closeParen === -1 || brace === -1) return text
	return `${text.slice(paren + 1, closeParen).trim()} ${text.slice(brace).trim()}`
}

/**
 * A leading `:host` compound in a flat selector, located: the wrapper span
 * and, when present, its argument span. After the flattening pass `:host`
 * is always the leading compound of a complex selector — shadow-root CSS
 * has no other legal position, and lightningcss keeps it verbatim.
 */
const leadingHost = (
	selector: string,
): { wrapper: [number, number]; args: [number, number] | null } | null => {
	const match = /^:host(?![a-zA-Z-])/.exec(selector)
	if (!match) return null
	const paren = selector.indexOf('(', match[0].length)
	if (paren !== match[0].length)
		return { wrapper: [0, match[0].length], args: null }
	const close = matchingParen(selector, paren)
	if (close === -1) return { wrapper: [0, match[0].length], args: null }
	return { wrapper: [0, close + 1], args: [paren + 1, close] }
}

/**
 * A trailing pseudo — element (`::before`, legacy `:before`, `::part(x)`)
 * or class (`:hover`) — closing the complex selector. The guard inserts
 * BEFORE the run: `:where()` cannot attach after a pseudo-element, and the
 * flattening pass may emit the legacy single-colon spelling for the four
 * CSS2.1 pseudo-elements. Anchoring the guard one compound earlier is
 * semantically identical — it constrains the same element.
 */
const TRAILING_PSEUDO = /(?:::?[a-zA-Z][\w-]*(?:\([^()]*\))?)\s*$/

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

/**
 * Rewrite one flat complex selector for the emission mode.
 *
 * Native: only `:host` rewrites — `:host` → `:where(:scope)`,
 * `:host(<sel>)` → `:where(:scope:is(<sel>))` (zero specificity, page
 * styles win as over `:host` in a shadow root).
 *
 * Lowered: the scope root leads (`${tag} ${selector}`), a zero-specificity
 * guard per boundary tag closes the subject, and `:host` becomes
 * `:where(${tag})` / `:where(${tag}:is(<sel>))`. A bare `:host` rule —
 * subject the host itself — and any `:host`-led selector skip the tag
 * prefix (the host compound already anchors the root); a bare `:host` also
 * skips the guard (the host is always in scope).
 */
const rewriteSelector = (
	selectorText: string,
	tag: string,
	mode: ScopeMode,
	boundaries: readonly string[],
): string =>
	splitTopLevelCommas(selectorText)
		.map(part => rewriteComplexSelector(part, tag, mode, boundaries))
		.join(', ')

const rewriteComplexSelector = (
	selectorText: string,
	tag: string,
	mode: ScopeMode,
	boundaries: readonly string[],
): string => {
	const selector = selectorText.trim()
	const host = leadingHost(selector)
	const guard =
		boundaries.length > 0
			? `:where(:not(${boundaries
					.flatMap(b => [`${tag} ${b} > *`, `${tag} ${b} > * *`])
					.join(', ')}))`
			: ''
	if (host) {
		const args = host.args
			? selector.slice(host.args[0], host.args[1]).trim()
			: null
		const hostText =
			mode === 'native'
				? args
					? `:where(:scope:is(${args}))`
					: ':where(:scope)'
				: args
					? `:where(${tag}:is(${args}))`
					: `:where(${tag})`
		const rest = selector.slice(host.wrapper[1])
		if (rest.trim() === '') return hostText
		const rewritten = `${hostText}${rest}`
		if (mode === 'lowered' && guard) {
			const trailing = TRAILING_PSEUDO.exec(rewritten)
			const at = trailing ? (trailing.index as number) : rewritten.length
			return `${rewritten.slice(0, at)}${guard}${rewritten.slice(at)}`
		}
		return rewritten
	}
	if (mode === 'native') return selector
	// R1 (owner, 2026-10-02): the scope root leads as `:where(tag)` — zero
	// specificity, so a lowered rule carries the same specificity as its
	// native form (`:where(my-el) .x` ≙ `.x` under `@scope`).
	const prefixed = `:where(${tag}) ${selector}`
	if (!guard) return prefixed
	const trailing = TRAILING_PSEUDO.exec(prefixed)
	const at = trailing ? (trailing.index as number) : prefixed.length
	return `${prefixed.slice(0, at)}${guard}${prefixed.slice(at)}`
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

/**
 * Emit the scoped stylesheet (ADR 0033 s3/s4): partition the authored
 * sheet, flatten the scoped remainder's nesting through a plain
 * lightningcss `transform` (never the visitor write path — see the module
 * doc), rewrite every flat selector for the mode, and assemble the
 * fragments before the `@scope` block (native) or the lowered rules.
 */
export const emitScopedSheet = (
	sheet: unknown,
	sheetText: string,
	tag: string,
	boundaries: readonly string[],
	cssTargets: CssTargets,
): string => {
	const mode = scopeModeOf(cssTargets)
	const { canonical, fragments, scopedSpans } = partitionSheet(sheet, sheetText)

	const hoisted = fragments.map(fragment =>
		fragmentText(fragment, canonical).trim(),
	)

	let flat = ''
	if (scopedSpans.length > 0) {
		// The scoped remainder: the canonical sheet with every hoisted
		// fragment's span removed, separators and all — lightningcss
		// reformats what it re-emits.
		const scoped = splice(
			canonical,
			fragments.map(fragment => ({
				start: fragment.start,
				end: fragment.end,
				text: '',
			})),
		)
		const lowered = transform({
			code: Buffer.from(scoped) as Buffer,
			filename: 'scoped.css',
			...flatteningTargets(cssTargets),
		})
		flat = new TextDecoder().decode(lowered.code).trim()
	}

	let scopedEmitted = ''
	if (flat !== '') {
		const rules: TextRule[] = []
		collectTextRules(flat, 0, flat.length, rules)
		const replacements = rules
			.filter(rule => atRuleName(flat, rule) === null)
			.map(rule => {
				const rewritten = rewriteSelector(
					flat.slice(rule.start, rule.brace),
					tag,
					mode,
					boundaries,
				)
				return { start: rule.start, end: rule.brace, text: `${rewritten} ` }
			})
		scopedEmitted = splice(flat, replacements)
	}

	const parts: string[] = []
	for (const fragment of hoisted) if (fragment !== '') parts.push(fragment)
	if (scopedEmitted !== '') {
		parts.push(
			mode === 'native'
				? `@scope (${tag})${
						boundaries.length
							? ` to (${boundaries.map(b => `${b} > *`).join(', ')})`
							: ''
					} {\n${scopedEmitted}\n}`
				: scopedEmitted,
		)
	}
	return parts.length > 0 ? `${parts.join('\n\n')}\n` : ''
}
