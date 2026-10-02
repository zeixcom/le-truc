/**
 * The tag-led → shadow-root codemod (LT-306, ADR 0033 s2).
 *
 * Every compiled corpus stylesheet moved from tag-led nesting
 * (`my-element { … & .x { … } }`) to the shadow-root authored form
 * (`:host { … }` plus bare rules). The transform is mechanical, so it is
 * a codemod over lightningcss's parse rather than a hand edit — and it
 * stays committed for pioneer projects migrating a 2.x corpus.
 *
 * 	bun scripts/migrate-shadow-css.ts
 *
 * Per compiled source (`.tsx`/`.tsrx`; the `.ts` twins are not compiled
 * and keep their tag-led hand-written `.css` verbatim):
 *
 * 1. flatten the sheet's nesting (plain lightningcss `transform`, targets
 *    capped just below native nesting support — the same pass the scoped
 *    emission uses, so what the codemod writes is what the compiler sees);
 * 2. a rule led by the component's own tag becomes `:host` (its exact-tag
 *    selector), `:host > …` (a direct-child `>` — kept where it expresses
 *    real intent: direct children only), or the bare remainder (a
 *    descendant — the defensive prefix drops);
 * 3. every other top-level rule is a page-level rule (e.g.
 *    module-dialog's `body.scroll-lock`) and wraps in `:global(…)`;
 * 4. rules inside `@media`/`@supports`/`@container`/`@layer` migrate the
 *    same way, minus the `:global` wrap (they are not sheet-top-level).
 *
 * Idempotent: a shadow-root sheet passes through unchanged (`:host` is
 * not tag-led; `:global`-wrapped rules stay wrapped — the codemod never
 * rewrites a rule already inside `:global(…)`).
 */

import {
	existsSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { Features, transform } from 'lightningcss-wasm'
import { dedentCss } from '../server/compiler/css'

const EXAMPLES_DIR = new URL('../examples', import.meta.url).pathname

/* --- the same text scanning the scoped emission uses (compiled below) --- */

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

type TextRule = { start: number; end: number; brace: number }

const atRuleName = (text: string, rule: TextRule): string | null => {
	if (text[rule.start] !== '@') return null
	const match = /^@([a-zA-Z-]+)/.exec(text.slice(rule.start, rule.brace))
	return match?.[1] ?? null
}


const collectTextRules = (
	text: string,
	from: number,
	to: number,
	out: TextRule[],
): void => {
	let i = skipSpaceAndComments(text, from)
	while (i < to && i < text.length) {
		const brace = indexOfUnquoted(text, '{', i)
		if (brace === -1 || brace >= to) break
		const close = matchingBrace(text, brace)
		if (close === -1 || close >= to) break
		const rule: TextRule = { start: i, end: close + 1, brace }
		out.push(rule)
		if (RECURSABLE.includes(atRuleName(text, rule) ?? ''))
			collectTextRules(text, brace + 1, close, out)
		i = skipSpaceAndComments(text, close + 1)
	}
}

/* --- the transform --- */

/** Flatten nesting with the emission's own capping (plain path, no visitor). */
const flatten = (sheetText: string): string => {
	// `include: Nesting`, not a nesting-less target: the migration must not
	// lower anything the authored sheet means to ship as authored (the
	// compiler's own emission lowers per cssTargets) — and a nesting-less
	// target cap would also lower strictly-younger features like
	// light-dark(), whose lowering emits var() usages without their
	// companion definitions.
	const lowered = transform({
		code: Buffer.from(sheetText) as Buffer,
		filename: 'migrate.css',
		targets: {},
		include: Features.Nesting,
	})
	return new TextDecoder().decode(lowered.code)
}

/**
 * Normalize a bare `:host` compound that carries qualifiers (R3, owner
 * 2026-10-02): `:host:hover`, `:host.x` and `:host[attr]` match nothing in
 * a shadow root — the first qualifier moves into the arguments
 * (`:host(:hover)`), the rest rides along. A pseudo-element after the
 * compound stays outside (`:host(.x)::before`).
 */
const hostQualifierArgs = (text: string): string =>
	text.replace(/:host(?=[.[:\w])((?:\.[\w-]+|::[a-zA-Z][\w-]*|:[a-zA-Z][\w-]*(?:\([^()]*\))?)+)/g, (whole, qualifiers: string) => {
		const qualRe = /^(\.[\w-]+|\[[^\]]*\]|::[a-zA-Z][\w-]*|:[a-zA-Z][\w-]*(?:\([^()]*\))?)/
		let rest = qualifiers
		let args = ''
		let trailing = ''
		for (;;) {
			const m = qualRe.exec(rest)
			if (!m) break
			const q = m[0] as string
			const isPseudoElement =
				q.startsWith('::') ||
				/^:(before|after|first-line|first-letter)(?![\w-])/.test(q)
			if (isPseudoElement || args !== '') trailing += q
			else args += q
			rest = rest.slice(q.length)
		}
		void whole
		return args ? `:host(${args})${trailing}${rest}` : `:host${trailing}${rest}`
	})

/**
 * Migrate one selector part under a nesting context (selector-text-only —
 * values, nesting and comments never move):
 *
 * - top level (context undefined): a rule led by the component's own tag
 *   loses the tag (`:host`; `:host >` keeps a real direct-child `>`); a
 *   part naming another custom element keeps its tag-led selector under a
 *   whole-rule `:global(…)` when `crossBoundaryAsGlobal` (content the
 *   component authored through a compose hole — the scoped boundary stops
 *   at the child); any other sheet-top-level part is a page rule and wraps
 *   in `:global(…)`.
 * - nested under the tag-led root (context ''): `&` is the host — `& x`
 *   becomes the bare `x`, `& > x` the kept-intent `:host > x`, `&:hover`
 *   the R3 form `:host(:hover)`.
 * - nested deeper (context = the parent's migrated selector): `&` is that
 *   selector; a missing `&` is an implicit descendant.
 */
const migratePart = (
	part: string,
	tag: string,
	context: string | undefined,
	crossBoundaryAsGlobal: boolean,
): string => {
	const selector = part.trim()
	if (context === undefined) {
		if (selector === tag) return ':host'
		const childPrefix = `${tag} > `
		if (selector.startsWith(childPrefix))
			return `:host > ${selector.slice(childPrefix.length)}`
		const descendantPrefix = `${tag} `
		if (selector.startsWith(descendantPrefix)) {
			const bare = selector.slice(descendantPrefix.length)
			if (crossBoundaryAsGlobal && /\b[a-z][a-z0-9]*-[a-z0-9-]+\b/.test(bare))
				return `:global(${selector})`
			return bare
		}
		const childNoSpace = `${tag}>`
		if (selector.startsWith(childNoSpace))
			return `:host >${selector.slice(childNoSpace.length)}`
		// An already-shadow `:host` compound with qualifiers normalizes per R3.
		if (selector.startsWith(':host')) return hostQualifierArgs(selector)
		if (selector.startsWith('&')) return hostQualifierArgs(migratePartWithRootAmpersand(selector, tag))
		if (selector.includes(':global')) return selector
		return `:global(${selector})`
	}
	if (context === '') {
		// Children of the tag-led root rule.
		const rootChildPrefix = '& > '
		if (selector.startsWith(rootChildPrefix))
			return `:host > ${selector.slice(rootChildPrefix.length)}`
		if (selector.startsWith('>'))
			return `:host ${selector}`
		if (selector.startsWith('&')) {
			const rest = selector.slice(1)
			// `&:hover` — the host, qualified (R3 form).
			if (/^[.[:]/.test(rest) || /^:[a-zA-Z]/.test(rest))
				return hostQualifierArgs(`:host${rest}`)
			// `&::before` — pseudo-elements trail the host compound.
			if (rest.startsWith(':'))
				return `:host${rest}`
			// `& button` — the bare descendant idiom.
			return rest.trimStart()
		}
		return hostQualifierArgs(selector)
	}
	// Deeper nesting: `&` is the parent's migrated selector.
	if (selector.includes('&')) {
		const replaced = selector.replace(/&/g, context)
		return hostQualifierArgs(replaced)
	}
	return hostQualifierArgs(`${context} ${selector}`)
}

/** `&…` at the root: the `&` is the host itself. */
const migratePartWithRootAmpersand = (selector: string, tag: string): string => {
	void tag
	const rest = selector.slice(1)
	if (rest.startsWith(' > ')) return `:host > ${rest.slice(3)}`
	if (rest.startsWith('>')) return `:host ${rest.slice(1)}`
	if (/^[.[:]/.test(rest) || /^:[a-zA-Z]/.test(rest)) return `:host${rest}`
	return rest.trimStart()
}

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

/** One rule rewrite: the new selector text, or null to keep the rule. */
const migrateSelectorText = (
	selectorText: string,
	tag: string,
	context: string | undefined,
	crossBoundaryAsGlobal: boolean,
): string | null => {
	const parts = splitTopLevelCommas(selectorText)
	const migrated = parts.map(part =>
		migratePart(part, tag, context, crossBoundaryAsGlobal),
	)
	if (migrated.every((m, index) => m === parts[index]?.trim()))
		return null
	return `${migrated.join(',')} `
}

type Hoisted = { atRule: string; rule: string }

const RECURSABLE = ['media', 'supports', 'container', 'layer', 'starting-style', 'scope']

/**
 * Walk the authored sheet, rewriting every style rule's SELECTOR TEXT in
 * place — declarations, values, comments and the nesting itself never
 * move. `context` is the parent rule's migrated selector ('' = children of
 * the tag-led root, undefined = sheet top level).
 */
const migrateRulesInPlace = (
	text: string,
	from: number,
	to: number,
	tag: string,
	context: string | undefined,
	crossBoundaryAsGlobal: boolean,
	replacements: Array<{ start: number; end: number; text: string }>,
	hoisted: Hoisted[],
): void => {
	const rules: TextRule[] = []
	collectTextRules(text, from, to, rules)
	// collectTextRules already recurses into recursable at-rules, so the
	// flat list holds inner rules too — skip anything inside an at-rule
	// span this loop has processed (the recursion owns those).
	const atRuleRanges: Array<[number, number]> = []
	const insideProcessed = (rule: TextRule): boolean =>
		atRuleRanges.some(([start, end]) => rule.start > start && rule.end < end)
	for (const rule of rules) {
		if (insideProcessed(rule)) continue
		const name = atRuleName(text, rule)
		if (name !== null) {
			if (RECURSABLE.includes(name))
				atRuleRanges.push([rule.start, rule.end])
			// A cross-boundary rule inside a recursable at-rule cannot become
			// an in-place `:global` (the nested form, LTC069): the original
			// rule hoists into a top-level bare `:global` block that carries
			// the at-rule, preserving the condition.
			if (crossBoundaryAsGlobal && hoisted && RECURSABLE.includes(name)) {
				const inner: TextRule[] = []
				collectTextRules(text, rule.brace + 1, rule.end - 1, inner)
				for (const child of inner) {
					if (atRuleName(text, child) !== null) continue
					const childSelector = text.slice(child.start, child.brace)
					const migratedChild = migrateSelectorText(
						childSelector,
						tag,
						undefined,
						crossBoundaryAsGlobal,
					)
					if (
						migratedChild !== null &&
						migratedChild.includes(':global(') &&
						!childSelector.includes(':global')
					) {
						hoisted.push({
							atRule: text.slice(rule.start, rule.brace + 1).trim(),
							rule: text.slice(child.start, child.end).trim(),
						})
						replacements.push({
							start: child.start,
							end: child.end,
							text: '',
						})
					}
				}
			}
			if (RECURSABLE.includes(name))
				migrateRulesInPlace(
					text,
					rule.brace + 1,
					rule.end - 1,
					tag,
					context,
					crossBoundaryAsGlobal,
					replacements,
					hoisted,
				)
			continue
		}
		const selectorText = text.slice(rule.start, rule.brace)
		const migrated = migrateSelectorText(
			selectorText,
			tag,
			context,
			crossBoundaryAsGlobal,
		)
		if (migrated !== null)
			replacements.push({
				start: rule.start,
				end: rule.brace,
				text: migrated,
			})
	}
}


/**
 * Migrate one authored sheet's selectors to the shadow-root form
 * (idempotent — a sheet already carrying a `:host`-led rule passes
 * through; a 2.x tag-led sheet never carries one).
 */
export const migrateShadowCss = (
	sheetText: string,
	tag: string,
	crossBoundaryAsGlobal = false,
): string => {
	const topRules: TextRule[] = []
	collectTextRules(sheetText, 0, sheetText.length, topRules)
	const alreadyMigrated = topRules.some(
		rule =>
			atRuleName(sheetText, rule) === null &&
			sheetText.slice(rule.start, rule.brace).trim().startsWith(':host'),
	)
	if (alreadyMigrated) return sheetText
	const replacements: Array<{ start: number; end: number; text: string }> = []
	const hoisted: Hoisted[] = []
	migrateRulesInPlace(
		sheetText,
		0,
		sheetText.length,
		tag,
		undefined,
		crossBoundaryAsGlobal,
		replacements,
		hoisted,
	)
	let out = sheetText
	for (const { start, end, text } of [...replacements].sort(
		(a, b) => b.start - a.start,
	))
		out = out.slice(0, start) + text + out.slice(end)
	// The hoisted cross-boundary rules land in one bare `:global` block at
	// the sheet's end, grouped per at-rule prelude.
	if (hoisted.length > 0) {
		const byAtRule = new Map<string, string[]>()
		for (const { atRule, rule } of hoisted) {
			const rules = byAtRule.get(atRule) ?? []
			rules.push(rule)
			byAtRule.set(atRule, rules)
		}
		const block = [...byAtRule]
			.map(([atRule, rules]) => `${atRule}\n${rules.join('\n')}\n}`)
			.join('\n\n')
		out = `${out.trimEnd()}\n\n:global {\n${block}\n}`
	}
	return out
}

/* --- the corpus walk --- */

/** `<style>{css`…`}</style>` (.tsx) or plain `<style>…</style>` (.tsrx). */
const STYLE_TSX = /<style>\s*\{css`([\s\S]*?)`\}<\/style>/
const STYLE_TSRX = /<style>([\s\S]*?)<\/style>/
/**
 * The same shapes as they appear inside a template-literal fixture in a
 * test file, where the backticks are escaped (`\``).
 */
const STYLE_TSX_ESCAPED = /<style>\s*\{css\\`([\s\S]*?)\\`\}<\/style>/

const listSources = (dir: string): string[] => {
	const out: string[] = []
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry)
		if (statSync(path).isDirectory()) out.push(...listSources(path))
		else if (/\.(tsx|tsrx)$/.test(entry)) out.push(path)
	}
	return out
}

const tagOf = (path: string): string =>
	(path.split('/').pop() ?? '').replace(/\.(tsx|tsrx)$/, '')

/** The block's own base indentation, so the migrated sheet re-indents in place. */
const baseIndentOf = (sheetText: string): string => {
	const line = sheetText.split('\n').find(l => l.trim().length > 0)
	return line?.match(/^[ \t]*/)?.[0] ?? ''
}

const indent = (text: string, pad: string): string =>
	text
		.split('\n')
		.map(line => (line.trim().length > 0 ? pad + line : line))
		.join('\n')

let migrated = 0
const run = async (): Promise<void> => {
	for (const path of listSources(EXAMPLES_DIR)) {
		const source = readFileSync(path, 'utf8')
		const isTsx = path.endsWith('.tsx')
		const match = isTsx ? STYLE_TSX.exec(source) : STYLE_TSRX.exec(source)
		if (!match) continue
		const tag = tagOf(path)
		const sheetText = match[1]
		// Migrate the DEDENTED sheet: lightningcss's printer carries a
		// multi-line value's authored line breaks and indentation through,
		// and a variant set's members may sit at different base depths —
		// canonical input makes the members' outputs byte-identical
		// (LTC051), whatever their authored indentation.
		const next = migrateShadowCss(dedentCss(sheetText), tag)
		if (next === dedentCss(sheetText)) continue
		const pad = baseIndentOf(sheetText)
		// The authored sheet usually opens with a newline after the wrapper;
		// the migrated text must keep that shape.
		const leadingNewline = sheetText.startsWith('\n') ? '\n' : ''
		const replacement = match[0].replace(
			sheetText,
			leadingNewline + indent(next.trimEnd(), pad),
		)
		writeFileSync(
			path,
			source.slice(0, match.index) +
				replacement +
				source.slice(match.index + match[0].length),
		)
		console.log(`✅ ${path}`)
		migrated++
	}
	console.log(`\n${migrated} sheet(s) migrated to the shadow-root form.`)
}

// A guard, not decoration: the transform below is imported by the tests,
// and an import must never rewrite the corpus. `--tests`, `--sync-twins`
// and `--from-twins` run their own passes instead.
if (
	import.meta.main &&
	!process.argv.includes('--tests') &&
	!process.argv.includes('--sync-twins') &&
	!process.argv.includes('--from-twins')
)
	await run()

/* === One-shot fixture migration (`--tests`) === */

/**
 * `bun scripts/migrate-shadow-css.ts --tests` — the one-shot companion run
 * for THIS repo's test fixtures: every inline `<style>…</style>` /
 * `<style>{css`…`}</style>` block in `server/tests` whose sheet is tag-led
 * migrates under the tag its own rules lead with (the fixtures are
 * tag-led BY their component's tag, so the sheet itself names it). Sheets
 * already in shadow-root form pass through; blocks asserting the
 * LTC066–LTC069 errors are written later by the LT-304 tests themselves.
 */
const TESTS_DIR = new URL('../server/tests', import.meta.url).pathname

const listTestFiles = (dir: string): string[] => {
	const out: string[] = []
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry)
		if (statSync(path).isDirectory()) out.push(...listTestFiles(path))
		else if (/\.(test\.ts|tsx|tsrx)$/.test(entry)) out.push(path)
	}
	return out
}

/** The dashed tag a sheet's first rule leads with, when tag-led. */
const ledTagOf = (sheetText: string): string | null => {
	const open = skipSpaceAndComments(sheetText, 0)
	const match = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\s*[{,\s]/.exec(
		sheetText.slice(open),
	)
	return match?.[1] ?? null
}

const migrateFixtureFile = (source: string): string => {
	let out = source
	const patterns = [STYLE_TSX, STYLE_TSX_ESCAPED, STYLE_TSRX]
	for (const pattern of patterns) {
		out = out.replace(
			new RegExp(pattern.source, pattern.flags + 'g'),
			(whole: string, sheetText: string) => {
				// A dynamic fixture interpolates its sheet — not static CSS;
				// its author migrates it by hand where the construction happens.
				if (sheetText.includes('${')) return whole
				const tag = ledTagOf(sheetText)
				if (!tag) return whole
				let next: string
				try {
					next = migrateShadowCss(dedentCss(sheetText), tag)
				} catch {
					// A block lightningcss refuses is a deliberate non-CSS
					// fixture (string bodies, expression probes) — untouched.
					return whole
				}
				if (next === dedentCss(sheetText)) return whole
				// Inline fixtures sit inside template literals at the author's
				// indentation; single-rule sheets stay on one line to keep the
				// fixtures readable.
				const oneLine = next.trim().replace(/\n\n/g, '\n')
				const pad = baseIndentOf(sheetText)
				return whole.replace(sheetText, indent(oneLine.trimEnd(), pad))
			},
		)
	}
	return out
}

if (import.meta.main && process.argv.includes('--tests')) {
	let count = 0
	for (const path of listTestFiles(TESTS_DIR)) {
		const source = readFileSync(path, 'utf8')
		const next = migrateFixtureFile(source)
		if (next !== source) {
			writeFileSync(path, next)
			console.log(`✅ ${path}`)
			count++
		}
	}
	console.log(`\n${count} test fixture file(s) migrated.`)
}


/**
 * `bun scripts/migrate-shadow-css.ts --from-twins` — the decisive LT-306
 * parity pass. Before this landing the pages served the HAND-WRITTEN twin
 * `.css` files, and the compiled sheets' own content had drifted from them
 * in BOTH directions (the sheets were written to `server/generated/` but
 * never served). With `examples/main.css` repointed at the emitted CSS,
 * pixel parity with the pre-landing pages requires the served stylesheet
 * to stay the twin's content — migrated to the shadow-root form. For every
 * compiled source WITH a sibling `.css` twin, this replaces the `<style>`
 * block's content with `migrateShadowCss(twin)`: the previously served
 * truth, authored as shadow-root CSS. Twin-less components (compiled
 * sheets that were always the artifact of record) are untouched, and a
 * sheet already equal to the migrated twin passes through (idempotent).
 */
const fromTwins = async (): Promise<void> => {
	let count = 0
	for (const path of listSources(EXAMPLES_DIR)) {
		const twin = path.replace(/\.(tsx|tsrx)$/, '.css')
		if (!existsSync(twin)) continue
		const source = readFileSync(path, 'utf8')
		const isTsx = path.endsWith('.tsx')
		const match = isTsx ? STYLE_TSX.exec(source) : STYLE_TSRX.exec(source)
		if (!match) continue
		const tag = tagOf(path)
		const sheetText = match[1]
		const migrated = migrateShadowCss(
			dedentCss(readFileSync(twin, 'utf8')),
			tag,
			true,
		)
		if (dedentCss(sheetText) === migrated) continue
		const pad = baseIndentOf(sheetText)
		const leadingNewline = sheetText.startsWith('\n') ? '\n' : ''
		const replacement = match[0].replace(
			sheetText,
			leadingNewline + indent(migrated.trimEnd(), pad),
		)
		writeFileSync(
			path,
			source.slice(0, match.index) +
				replacement +
				source.slice(match.index + match[0].length),
		)
		console.log(`✅ ${path} (sheet := migrated twin)`)
		count++
	}
	console.log(`\n${count} sheet(s) replaced from their twins.`)
}

if (import.meta.main && process.argv.includes('--from-twins')) await fromTwins()
