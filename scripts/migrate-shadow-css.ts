/**
 * The tag-led → shadow-root codemod (LT-306, ADR 0033 s2).
 *
 * Every compiled corpus stylesheet moved from tag-led nesting
 * (`my-element { … & .x { … } }`) to the shadow-root authored form
 * (`:host { … }` plus bare rules). The transform is mechanical, so it is
 * a codemod — a comment- and string-aware scan of the selector text —
 * rather than a hand edit, and it stays committed for pioneer projects
 * migrating a 2.x corpus.
 *
 * 	bun scripts/migrate-shadow-css.ts
 *
 * Per compiled source (`.tsx`/`.tsrx`; the `.ts` twins are not compiled
 * and keep their tag-led hand-written `.css` verbatim), rewriting SELECTOR
 * TEXT ONLY — values, comments and the nesting itself never move:
 *
 * 1. a sheet-level rule led by the component's own tag becomes `:host`
 *    (its exact-tag selector), `:host > …` (a direct-child `>` — kept
 *    where it expresses real intent), or the bare remainder (a descendant
 *    — the defensive prefix drops). Nested rules keep their text: `&`
 *    then means the migrated parent;
 * 2. every other sheet-level rule is a page-level rule (e.g.
 *    module-dialog's `body.scroll-lock`) and wraps in `:global(…)`;
 * 3. at every nesting level, a selector that descends past a custom
 *    element (`child-el .x`, `child-el > .x` — LTC071's shape, LT-399)
 *    leaves the scope as a page-level rule under its resolved tag-led
 *    selector (LT-400). A composed child's own tag as the subject, and
 *    its siblings, stay scoped;
 * 4. a page-level rule that cannot stay in place — nested, or under
 *    `@media`/`@supports`/`@container`/`@layer` — hoists with its
 *    conditions into one trailing bare `:global { … }` block (a nested
 *    `:global` is LTC069); a rule left empty by the hoist drops.
 *
 * Idempotent: a shadow-root sheet passes through unchanged (`:host` is
 * not tag-led; `:global`-wrapped rules stay wrapped — the codemod never
 * rewrites a rule already inside `:global(…)`).
 */

import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
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
		// A declaration or blockless statement ends at its `;` — inside a
		// rule body the walk meets declarations before nested rules (LT-400,
		// the emission's LT-398 fix).
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
		const rule: TextRule = { start: i, end: close + 1, brace }
		out.push(rule)
		if (RECURSABLE.includes(atRuleName(text, rule) ?? ''))
			collectTextRules(text, brace + 1, close, out)
		i = skipSpaceAndComments(text, close + 1)
	}
}

/* --- the transform --- */

/**
 * Normalize a bare `:host` compound that carries qualifiers (R3, owner
 * 2026-10-02): `:host:hover`, `:host.x` and `:host[attr]` match nothing in
 * a shadow root — the first qualifier moves into the arguments
 * (`:host(:hover)`), the rest rides along. A pseudo-element after the
 * compound stays outside (`:host(.x)::before`).
 */
const hostQualifierArgs = (text: string): string =>
	text.replace(
		/:host(?=[.[:\w])((?:\.[\w-]+|::[a-zA-Z][\w-]*|:[a-zA-Z][\w-]*(?:\([^()]*\))?)+)/g,
		(whole, qualifiers: string) => {
			const qualRe =
				/^(\.[\w-]+|\[[^\]]*\]|::[a-zA-Z][\w-]*|:[a-zA-Z][\w-]*(?:\([^()]*\))?)/
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
			return args
				? `:host(${args})${trailing}${rest}`
				: `:host${trailing}${rest}`
		},
	)

/**
 * Migrate one selector part under a nesting context (selector-text-only —
 * values, nesting and comments never move):
 *
 * - top level (context undefined): a rule led by the component's own tag
 *   loses the tag (`:host`; `:host >` keeps a real direct-child `>`), or
 *   keeps the bare remainder (a descendant — the defensive prefix drops;
 *   a composed child's own tag stays stylable, ADR 0033 s2); any other
 *   sheet-top-level part is a page rule and wraps in `:global(…)`. Parts
 *   that descend past a custom element never reach here — the walk hoists
 *   them first (`descendsPastCustomElement`, LT-400).
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
): string => {
	const selector = part.trim()
	if (context === undefined) {
		if (selector === tag) return ':host'
		const childPrefix = `${tag} > `
		if (selector.startsWith(childPrefix))
			return `:host > ${selector.slice(childPrefix.length)}`
		const descendantPrefix = `${tag} `
		if (selector.startsWith(descendantPrefix))
			return selector.slice(descendantPrefix.length)
		const childNoSpace = `${tag}>`
		if (selector.startsWith(childNoSpace))
			return `:host >${selector.slice(childNoSpace.length)}`
		// An already-shadow `:host` compound with qualifiers normalizes per R3.
		if (selector.startsWith(':host')) return hostQualifierArgs(selector)
		if (selector.startsWith('&'))
			return hostQualifierArgs(migratePartWithRootAmpersand(selector, tag))
		if (selector.includes(':global')) return selector
		return `:global(${selector})`
	}
	if (context === '') {
		// Children of the tag-led root rule.
		const rootChildPrefix = '& > '
		if (selector.startsWith(rootChildPrefix))
			return `:host > ${selector.slice(rootChildPrefix.length)}`
		if (selector.startsWith('>')) return `:host ${selector}`
		if (selector.startsWith('&')) {
			const rest = selector.slice(1)
			// `&:hover` — the host, qualified (R3 form).
			if (/^[.[:]/.test(rest) || /^:[a-zA-Z]/.test(rest))
				return hostQualifierArgs(`:host${rest}`)
			// `&::before` — pseudo-elements trail the host compound.
			if (rest.startsWith(':')) return `:host${rest}`
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
const migratePartWithRootAmpersand = (
	selector: string,
	tag: string,
): string => {
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

/**
 * A custom element's type selector leading a compound — a dashed name in
 * type position, never a class (`.foo-bar`), id or attribute value.
 */
const CUSTOM_ELEMENT_TYPE = /^[a-z][a-z0-9]*-[a-z0-9-]*/

/**
 * Whether a resolved (nesting-free, tag-led) complex selector descends past
 * a custom element other than the component's own tag: a compound led by
 * one, followed by a descendant or child combinator (LT-400 — the shape
 * LTC071 rejects, LT-399). The subject is the child's content, which the
 * scope stops at; such a rule ships only as a page-level `:global` rule.
 * Sibling combinators and the child's own tag as the subject stay scoped.
 * Approximates the compiler's boundary set, which only the template knows:
 * every custom element counts.
 */
const descendsPastCustomElement = (selector: string, tag: string): boolean => {
	let depth = 0
	let compoundStart = true
	let customCompound = false
	for (let i = 0; i < selector.length; i++) {
		const c = selector[i] as string
		if (c === '"' || c === "'") {
			const quote = c
			i++
			while (i < selector.length && selector[i] !== quote) {
				if (selector[i] === '\\') i++
				i++
			}
			continue
		}
		if (c === '(' || c === '[') depth++
		else if (c === ')' || c === ']') depth--
		if (depth > 0 || c === ')' || c === ']') {
			compoundStart = false
			continue
		}
		if (/[\s>+~]/.test(c)) {
			// A combinator run: whitespace around a `>`/`+`/`~` is one combinator.
			let j = i
			let kind = ' '
			while (j < selector.length && /[\s>+~]/.test(selector[j] as string)) {
				if (selector[j] !== ' ' && !/\s/.test(selector[j] as string))
					kind = selector[j] as string
				j++
			}
			if (
				j < selector.length &&
				customCompound &&
				(kind === ' ' || kind === '>')
			)
				return true
			customCompound = false
			compoundStart = true
			i = j - 1
			continue
		}
		if (compoundStart) {
			const match = CUSTOM_ELEMENT_TYPE.exec(selector.slice(i))
			if (match && match[0] !== tag) customCompound = true
			compoundStart = false
		}
	}
	return false
}

/** Resolve a nested part against every parent alternative (`&` or implicit). */
const resolveAgainst = (part: string, parents: readonly string[]): string[] =>
	parents.map(parent =>
		part.includes('&') ? part.replace(/&/g, parent) : `${parent} ${part}`,
	)

type Hoisted = { atRules: string[]; rule: string }

const RECURSABLE = [
	'media',
	'supports',
	'container',
	'layer',
	'starting-style',
	'scope',
]

/**
 * Walk the authored sheet, rewriting every style rule's SELECTOR TEXT in
 * place — declarations, values, comments and the nesting itself never
 * move — nested selectors keep their text, since `&` then means the
 * migrated parent. `originals` holds the parent's resolved tag-led
 * alternatives (undefined = sheet level), `atRules` the enclosing
 * conditions.
 *
 * At every level, a part that descends past a custom element (LT-400) —
 * or a page-level rule under a condition — cannot stay in the scope and
 * cannot be a nested `:global` (LTC069): it leaves as a page-level rule,
 * in place as `:global(…)` when the rule is sheet-top-level and
 * unconditioned, else hoisted with its conditions into the trailing bare
 * `:global { … }` block, under its resolved tag-led selector and with its
 * body verbatim (a nested `&` then resolves against that selector).
 */
const migrateRulesInPlace = (
	text: string,
	from: number,
	to: number,
	tag: string,
	originals: readonly string[] | undefined,
	atRules: readonly string[],
	replacements: Array<{ start: number; end: number; text: string }>,
	hoisted: Hoisted[],
): void => {
	const rules: TextRule[] = []
	collectTextRules(text, from, to, rules)
	// collectTextRules recurses into recursable at-rules, and style rules'
	// bodies are walked below, so skip anything inside a span this loop
	// has already handed to a recursion.
	const owned: Array<[number, number]> = []
	const insideOwned = (rule: TextRule): boolean =>
		owned.some(([start, end]) => rule.start > start && rule.end < end)
	for (const rule of rules) {
		if (insideOwned(rule)) continue
		owned.push([rule.start, rule.end])
		const name = atRuleName(text, rule)
		if (name !== null) {
			if (RECURSABLE.includes(name))
				migrateRulesInPlace(
					text,
					rule.brace + 1,
					rule.end - 1,
					tag,
					originals,
					[...atRules, text.slice(rule.start, rule.brace).trim()],
					replacements,
					hoisted,
				)
			continue
		}
		const selectorText = text.slice(rule.start, rule.brace)
		if (selectorText.includes(':global')) continue
		const parts = splitTopLevelCommas(selectorText).map(part => part.trim())
		const live: Array<{ part: string; resolved: string[] }> = []
		const leaving: string[] = []
		for (const part of parts) {
			const resolved = originals ? resolveAgainst(part, originals) : [part]
			if (resolved.every(r => descendsPastCustomElement(r, tag))) {
				leaving.push(...resolved)
				continue
			}
			if (
				originals === undefined &&
				migratePart(part, tag, undefined).startsWith(':global(')
			) {
				leaving.push(part)
				continue
			}
			live.push({ part, resolved })
		}
		const body = text.slice(rule.brace + 1, rule.end - 1)
		const topLevel = originals === undefined && atRules.length === 0
		if (leaving.length > 0 && live.length === 0 && topLevel) {
			// The whole rule is page-level: it stays put as `:global(…)`.
			replacements.push({
				start: rule.start,
				end: rule.brace,
				text: `:global(${leaving.join(', ')}) `,
			})
			continue
		}
		if (leaving.length > 0)
			hoisted.push({
				atRules: [...atRules],
				rule: `${leaving.join(',\n')} {\n${indent(dedentCss(body).trimEnd(), '\t')}\n}`,
			})
		if (live.length === 0) {
			replacements.push({ start: rule.start, end: rule.end, text: '' })
			continue
		}
		// Nested selectors keep their text: `&` already means the migrated
		// parent. Only sheet-level selectors (inside conditions or not) migrate.
		const migratedParts = live.map(({ part }) =>
			originals === undefined ? migratePart(part, tag, undefined) : part,
		)
		if (
			leaving.length > 0 ||
			migratedParts.some((m, index) => m !== live[index]?.part)
		)
			replacements.push({
				start: rule.start,
				end: rule.brace,
				text: `${migratedParts.join(',')} `,
			})
		migrateRulesInPlace(
			text,
			rule.brace + 1,
			rule.end - 1,
			tag,
			live.flatMap(({ resolved }) => resolved),
			atRules,
			replacements,
			hoisted,
		)
	}
}

/**
 * Drop style and conditional rules whose block holds nothing but
 * whitespace and comments — what a parent rule is left with once every
 * child hoisted out (LT-400). Repeats until stable: an emptied parent can
 * empty its own parent.
 */
const dropEmptyRules = (sheetText: string): string => {
	let out = sheetText
	// Every rule, style-rule bodies included (collectTextRules alone
	// recurses only into conditional groups).
	const allRules = (text: string, from: number, to: number): TextRule[] => {
		const found: TextRule[] = []
		collectTextRules(text, from, to, found)
		for (const rule of [...found])
			if (atRuleName(text, rule) === null)
				found.push(...allRules(text, rule.brace + 1, rule.end - 1))
		return found
	}
	for (;;) {
		const rules = allRules(out, 0, out.length)
		const empty = rules.find(rule => {
			const name = atRuleName(out, rule)
			if (name !== null && !RECURSABLE.includes(name)) return false
			const inner = out.slice(rule.brace + 1, rule.end - 1)
			return skipSpaceAndComments(inner, 0) >= inner.length
		})
		if (!empty) return out
		// Remove the rule with the whitespace that led up to it, so what
		// followed it (a closing brace, the next rule) keeps its own indent.
		let before = empty.start
		while (before > 0 && /\s/.test(out[before - 1] as string)) before--
		out = out.slice(0, before) + out.slice(empty.end)
	}
}

/**
 * Migrate one authored sheet's selectors to the shadow-root form
 * (idempotent — a sheet already carrying a `:host`-led rule passes
 * through; a 2.x tag-led sheet never carries one).
 */
export const migrateShadowCss = (sheetText: string, tag: string): string => {
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
		[],
		replacements,
		hoisted,
	)
	let out = sheetText
	for (const { start, end, text } of [...replacements].sort(
		(a, b) => b.start - a.start,
	))
		out = out.slice(0, start) + text + out.slice(end)
	out = dropEmptyRules(out)
	// The hoisted rules land in one bare `:global` block at the sheet's
	// end, each wrapped in its enclosing conditions, grouped per chain.
	if (hoisted.length > 0) {
		const byChain = new Map<string, Hoisted[]>()
		for (const entry of hoisted) {
			const key = entry.atRules.join('\u0000')
			byChain.set(key, [...(byChain.get(key) ?? []), entry])
		}
		const block = [...byChain.values()]
			.map(entries => {
				const rules = entries.map(entry => entry.rule).join('\n\n')
				return (entries[0]?.atRules ?? []).reduceRight(
					(inner, atRule) => `${atRule} {\n${indent(inner, '\t')}\n}`,
					rules,
				)
			})
			.join('\n\n')
		out = `${out.trimEnd()}\n\n:global {\n${indent(block, '\t')}\n}`
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
		const sheetText = match[1] ?? ''
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
// and an import must never rewrite the corpus. `--tests` and
// `--from-twins` run their own passes instead.
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
		const sheetText = match[1] ?? ''
		const migrated = migrateShadowCss(
			dedentCss(readFileSync(twin, 'utf8')),
			tag,
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
