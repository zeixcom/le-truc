/**
 * The shadow-root → authored `@scope` codemod (LT-501, ADR 0033 s1).
 *
 * Every compiled corpus stylesheet moves from the shadow-root authored form
 * (`:host { … }` plus bare rules, scope boundaries derived from the
 * template) to platform CSS in the ADR 0033 s1 idiom: the scoped rules sit
 * in a prelude-less `@scope { … }` block, host rules root at
 * `:where(:scope)`, descendants are bare, and the limits are written out.
 *
 * 	bun scripts/migrate-scope-css.ts <boundaries.json> [examples-dir]
 *
 * `<boundaries.json>` maps each component tag to the custom-element tags
 * the retired emission stopped its scope at. The codemod writes them as
 * the block's limits, `to (<tag> > *, …)`, so the migrated sheet reaches
 * what the old emission reached; LT-502's leak check shrinks them.
 *
 * Per compiled source (`.tsx` `<style>{css`…`}</style>`, `.tsrx`
 * `<style>…</style>`; the `.ts` twins keep their hand-written `.css`),
 * rewriting rule TEXT only — values and comments never change:
 *
 * 1. `@keyframes`, `@font-face`, `@property` and the other hoisted
 *    at-rules stay at the top level;
 * 2. `:global(<selector>) { … }` and the bare `:global { … }` block unwrap
 *    to top-level rules;
 * 3. everything else moves into one `@scope [to (…)] { … }` block:
 *    - `:host { … }` becomes `:where(:scope) { … }`, holding its
 *      declarations and the `&`-led root variants that hold only
 *      declarations;
 *    - every other rule nested in it moves out, in order: a descendant
 *      bare or relative (`& p` → `p`, `> p` stays), a state-dependent one
 *      led by the variant (`&.x .y` → `:where(:scope).x .y`);
 *    - `:host(X)` becomes `:where(:scope)X` (`:where(:scope):is(X)` for a
 *      type or a list), and `:host <desc>` becomes `<desc>`.
 *
 * The rules that move out of the host block follow it, so a root
 * declaration keeps its place before them; their specificity is the
 * nested form's, `:where(:scope)` counting zero.
 *
 * Idempotent: a sheet with a top-level `@scope` passes through unchanged.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

/* --- text scanning (comment- and string-aware) --- */

const skipString = (text: string, from: number): number => {
	const quote = text[from]
	let i = from + 1
	while (i < text.length && text[i] !== quote) {
		if (text[i] === '\\') i++
		i++
	}
	return i
}

const skipComment = (text: string, from: number): number => {
	const end = text.indexOf('*/', from + 2)
	return end === -1 ? text.length : end + 1
}

/** Index of the `)`/`}` closing the opener at `open`. */
const matching = (text: string, open: number): number => {
	const opener = text[open] as string
	const closer = opener === '(' ? ')' : '}'
	let depth = 0
	for (let i = open; i < text.length; i++) {
		const c = text[i] as string
		if (c === '"' || c === "'") i = skipString(text, i)
		else if (c === '/' && text[i + 1] === '*') i = skipComment(text, i)
		else if (c === opener) depth++
		else if (c === closer && --depth === 0) return i
	}
	return -1
}

const indexOfCode = (text: string, target: string, from: number): number => {
	for (let i = from; i < text.length; i++) {
		const c = text[i] as string
		if (c === '"' || c === "'") i = skipString(text, i)
		else if (c === '/' && text[i + 1] === '*') i = skipComment(text, i)
		else if (c === target) return i
	}
	return -1
}

const splitCommas = (text: string): string[] => {
	const parts: string[] = []
	let depth = 0
	let start = 0
	for (let i = 0; i < text.length; i++) {
		const c = text[i] as string
		if (c === '"' || c === "'") i = skipString(text, i)
		else if (c === '(' || c === '[') depth++
		else if (c === ')' || c === ']') depth--
		else if (c === ',' && depth === 0) {
			parts.push(text.slice(start, i))
			start = i + 1
		}
	}
	parts.push(text.slice(start))
	return parts
}

/** One item of a block: a declaration or a rule, with what led it. */
type Item = {
	/** The comments and whitespace before the item. */
	lead: string
	/** A blank line separated the item from the one before it. */
	blank: boolean
	/** The item through its `;` or `}`, from its first code character. */
	text: string
	/** For a rule: the prelude, comments removed. */
	prelude?: string
	/** For a rule: the `{` offset within `text`. */
	brace?: number
	/** For a rule: the text between its braces. */
	inner?: string
}

const stripComments = (text: string): string =>
	text.replace(/\/\*[\s\S]*?\*\//g, '')

const skipTrivia = (text: string, from: number): number => {
	let i = from
	for (;;) {
		while (i < text.length && /\s/.test(text[i] as string)) i++
		if (text.startsWith('/*', i)) i = skipComment(text, i) + 1
		else return i
	}
}

/** The declarations and rules of one block body, in order. */
const itemsOf = (body: string): { items: Item[]; rest: string } => {
	const items: Item[] = []
	let i = 0
	for (;;) {
		const at = skipTrivia(body, i)
		if (at >= body.length) return { items, rest: body.slice(i) }
		const lead = body.slice(i, at)
		const blank = /\n[ \t]*\n/.test(lead.replace(/\/\*[\s\S]*?\*\//g, ''))
		const brace = indexOfCode(body, '{', at)
		const semicolon = indexOfCode(body, ';', at)
		if (brace === -1 || (semicolon !== -1 && semicolon < brace)) {
			const end = semicolon === -1 ? body.length : semicolon + 1
			items.push({ lead, blank, text: body.slice(at, end) })
			i = end
			continue
		}
		const close = matching(body, brace)
		const end = close === -1 ? body.length : close + 1
		items.push({
			lead,
			blank,
			text: body.slice(at, end),
			prelude: stripComments(body.slice(at, brace)).trim(),
			brace: brace - at,
			inner: body.slice(brace + 1, end - 1),
		})
		i = end
	}
}

/** Comments in an item's lead, without the whitespace around them. */
const commentsOf = (lead: string): string =>
	(lead.match(/\/\*[\s\S]*?\*\//g) ?? []).join('\n')

/** Strip an item's own indentation from its continuation lines. */
const dedent = (text: string, indent: string): string =>
	text
		.split('\n')
		.map((line, index) =>
			index > 0 && line.startsWith(indent) ? line.slice(indent.length) : line,
		)
		.join('\n')

const indentBy = (text: string, indent: string): string =>
	text
		.split('\n')
		.map(line => (line.trim() === '' ? '' : `${indent}${line}`))
		.join('\n')

/** An item as a standalone text: its comments, then the item, dedented. */
const itemText = (item: Item, text = item.text): string => {
	const indent = /[ \t]*$/.exec(item.lead)?.[0] ?? ''
	const comments = dedent(commentsOf(item.lead), indent)
	return `${comments ? `${comments}\n` : ''}${dedent(text, indent)}`
}

/** A rule the codemod rebuilt, already indented, after the item's comments. */
const rebuiltText = (item: Item, text: string): string => {
	const indent = /[ \t]*$/.exec(item.lead)?.[0] ?? ''
	const comments = dedent(commentsOf(item.lead), indent)
	return `${comments ? `${comments}\n` : ''}${text}`
}

/** Items joined, keeping the authored blank lines between them. */
const joinItems = (parts: Array<{ text: string; blank: boolean }>): string =>
	parts
		.map((part, index) =>
			index > 0 && part.blank ? `\n${part.text}` : part.text,
		)
		.join('\n')

const HOISTED = new Set([
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

const ROOT = ':where(:scope)'

/** Whether a selector is one compound: no top-level combinator or list. */
const isCompound = (selector: string): boolean => {
	let depth = 0
	for (let i = 0; i < selector.length; i++) {
		const c = selector[i] as string
		if (c === '"' || c === "'") i = skipString(selector, i)
		else if (c === '(' || c === '[') depth++
		else if (c === ')' || c === ']') depth--
		else if (depth === 0 && /[\s>+~,]/.test(c)) return false
	}
	return true
}

/** `:host(X)`'s argument as a suffix of the root compound. */
const rootSuffix = (argument: string): string =>
	isCompound(argument) && !/^[a-zA-Z*|]/.test(argument)
		? argument
		: `:is(${argument})`

/** Every `:host(X)` → `:where(:scope)X`, `:host` → `:where(:scope)`; `:host-context` is left. */
const hostToRoot = (text: string): string => {
	let out = ''
	let i = 0
	while (i < text.length) {
		const c = text[i] as string
		if (c === '"' || c === "'") {
			const end = skipString(text, i)
			out += text.slice(i, end + 1)
			i = end + 1
		} else if (c === '/' && text[i + 1] === '*') {
			const end = skipComment(text, i)
			out += text.slice(i, end + 1)
			i = end + 1
		} else if (
			text.startsWith(':host', i) &&
			!/[\w-]/.test(text[i + 5] ?? '')
		) {
			if (text[i + 5] === '(') {
				const close = matching(text, i + 5)
				if (close !== -1) {
					out += `${ROOT}${rootSuffix(text.slice(i + 6, close).trim())}`
					i = close + 1
					continue
				}
			}
			out += ROOT
			i += 5
		} else {
			out += c
			i++
		}
	}
	return out
}

/** Where a selector's first compound ends. */
const firstCompoundEnd = (selector: string): number => {
	let depth = 0
	for (let i = 0; i < selector.length; i++) {
		const c = selector[i] as string
		if (c === '"' || c === "'") i = skipString(selector, i)
		else if (c === '(' || c === '[') depth++
		else if (c === ')' || c === ']') depth--
		else if (depth === 0 && /[\s>+~]/.test(c)) return i
	}
	return selector.length
}

/** One selector of the scope block, with whether its subject is the root. */
type Member = { text: string; root: boolean }

/**
 * A selector whose leading `lead` (`&` nested in the host block, `:host`
 * at the top) stands for the host: a root compound keeps it as
 * `:where(:scope)`, a descendant drops it and stays relative (`> p`) or
 * bare.
 */
const memberOf = (selector: string, lead: string, suffix: string): Member => {
	const rest = selector.slice(lead.length)
	if (rest === '' && suffix === '') return { text: ROOT, root: true }
	if (suffix === '' && /^[\s>+~]/.test(rest))
		return { text: rest.trim(), root: false }
	const end = firstCompoundEnd(rest)
	return {
		text: `${ROOT}${suffix}${hostToRoot(rest)}`,
		root: end === rest.length,
	}
}

/** A selector of a rule nested in the `:host` block. */
const nestedMember = (selector: string): Member => {
	const trimmed = selector.trim()
	return trimmed.startsWith('&')
		? memberOf(trimmed, '&', '')
		: { text: hostToRoot(trimmed), root: false }
}

/** A selector of a top-level rule of the shadow form. */
const topMember = (selector: string): Member => {
	const trimmed = selector.trim()
	if (!trimmed.startsWith(':host') || /^:host[\w-]/.test(trimmed))
		return { text: hostToRoot(trimmed), root: false }
	if (trimmed[5] === '(') {
		const close = matching(trimmed, 5)
		if (close !== -1)
			return memberOf(
				trimmed.slice(close + 1),
				'',
				rootSuffix(trimmed.slice(6, close).trim()),
			)
	}
	return memberOf(trimmed, ':host', '')
}

/** A selector list, one member per line when the authored list was. */
const joinMembers = (item: Item, members: readonly Member[]): string =>
	members
		.map(member => member.text)
		.join(item.prelude?.includes('\n') ? ',\n' : ', ')

/** A rule with a new prelude, its body as authored. */
const withPrelude = (item: Item, prelude: string): string =>
	itemText(item, `${prelude} ${item.text.slice(item.brace)}`)

/** Whether a block holds declarations only (conditional groups of them included). */
const declarationsOnly = (inner: string): boolean =>
	itemsOf(inner).items.every(
		item =>
			item.prelude === undefined ||
			(item.prelude.startsWith('@') && declarationsOnly(item.inner ?? '')),
	)

type Part = { text: string; blank: boolean }

/**
 * The `:host { … }` block's body: what stays in the root rule (its
 * declarations and `&`-led root variants that hold only declarations), and
 * the rules that move out, in order — descendants as bare or relative
 * rules, state-dependent descendants led by `:where(:scope)X`.
 */
const hostBody = (inner: string): { stay: Part[]; out: Part[] } => {
	const stay: Part[] = []
	const out: Part[] = []
	for (const item of itemsOf(inner).items) {
		if (item.prelude === undefined) {
			stay.push({
				text: itemText(item, hostToRoot(item.text)),
				blank: item.blank,
			})
			continue
		}
		if (item.prelude.startsWith('@')) {
			if (declarationsOnly(item.inner ?? '')) {
				stay.push({ text: itemText(item), blank: item.blank })
				continue
			}
			const nested = hostBody(item.inner ?? '')
			out.push({
				text: rebuiltText(
					item,
					`${item.prelude} {\n${indentBy(scopeParts(nested), '\t')}\n}`,
				),
				blank: true,
			})
			continue
		}
		const members = splitCommas(item.prelude).map(nestedMember)
		if (
			members.every(member => member.root) &&
			declarationsOnly(item.inner ?? '')
		)
			stay.push({ text: itemText(item), blank: item.blank })
		else
			out.push({
				text: withPrelude(item, joinMembers(item, members)),
				blank: true,
			})
	}
	return { stay, out }
}

/** The root rule, then the rules that moved out of it. */
const scopeParts = ({ stay, out }: { stay: Part[]; out: Part[] }): string =>
	[
		...(stay.length > 0
			? [`${ROOT} {\n${indentBy(joinItems(stay), '\t')}\n}`]
			: []),
		...out.map(part => part.text),
	].join('\n\n')

/** `:global(<selector>) { … }` members, unwrapped; null when not a global rule. */
const unwrapGlobalRule = (item: Item): string | null => {
	if (!item.prelude?.startsWith(':global')) return null
	// The bare block: its content is a list of top-level rules.
	if (item.prelude === ':global')
		return itemsOf(item.inner ?? '')
			.items.map(inner => itemText(inner))
			.join('\n\n')
	const members = splitCommas(item.prelude).map(member => {
		const trimmed = member.trim()
		if (!trimmed.startsWith(':global(')) return trimmed
		const close = matching(trimmed, ':global'.length)
		return close === -1
			? trimmed
			: trimmed.slice(':global('.length, close).trim()
	})
	return withPrelude(item, members.join(', '))
}

/** The shadow form's top-level scoped rules as the `@scope` block's content. */
const scopedRules = (items: readonly Item[]): string[] =>
	items.map(item => {
		const prelude = item.prelude ?? ''
		if (item.prelude === undefined) return itemText(item)
		if (prelude === ':host') return scopeParts(hostBody(item.inner ?? ''))
		if (prelude.startsWith('@'))
			return rebuiltText(
				item,
				`${prelude} {\n${indentBy(scopedRules(itemsOf(item.inner ?? '').items).join('\n\n'), '\t')}\n}`,
			)
		return withPrelude(
			item,
			joinMembers(item, splitCommas(prelude).map(topMember)),
		)
	})

/** Migrate one stylesheet's text; `boundaries` become the block's limits. */
export const migrateSheet = (
	sheet: string,
	boundaries: readonly string[],
): string => {
	const leadMatch = /^[ \t]*\n/.exec(sheet)
	const prefix = leadMatch ? leadMatch[0] : ''
	const firstContent = sheet.slice(prefix.length)
	const base = firstContent.match(/^[ \t]*/)?.[0] ?? ''
	const suffix = firstContent.slice(firstContent.trimEnd().length)
	const { items, rest } = itemsOf(firstContent.trimEnd())
	if (items.some(item => item.prelude?.startsWith('@scope'))) return sheet
	const top: string[] = []
	const scoped: Item[] = []
	for (const item of items) {
		const at = /^@([a-zA-Z-]+)/.exec(item.prelude ?? '')?.[1]
		if (at && HOISTED.has(at)) top.push(itemText(item))
		else {
			const unwrapped = unwrapGlobalRule(item)
			if (unwrapped !== null) top.push(unwrapped)
			else scoped.push(item)
		}
	}
	const trailing = commentsOf(rest)
	const limits = boundaries.length
		? ` to (${boundaries.map(tag => `${tag} > *`).join(', ')})`
		: ''
	const body = [...scopedRules(scoped), ...(trailing ? [trailing] : [])]
	const parts = [...top]
	if (body.length > 0)
		parts.push(`@scope${limits} {\n${indentBy(body.join('\n\n'), '\t')}\n}`)
	return `${prefix}${indentBy(parts.join('\n\n'), base)}${suffix}`
}

/* --- the walk --- */

const TSX_STYLE = /(<style>\{css`)([\s\S]*?)(`\}<\/style>)/g
// The tempered dot skips a `<style>` the file only MENTIONS in a comment.
const TSRX_STYLE = /(<style>)((?:(?!<style>)[\s\S])*?)(<\/style>)/g

export const migrateSource = (
	source: string,
	file: string,
	boundaries: readonly string[],
): string =>
	source.replace(
		file.endsWith('.tsrx') ? TSRX_STYLE : TSX_STYLE,
		(_, open: string, sheet: string, close: string) =>
			`${open}${migrateSheet(sheet, boundaries)}${close}`,
	)

const walk = (dir: string, out: string[] = []): string[] => {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) walk(path, out)
		else if (/\.(tsx|tsrx)$/.test(name)) out.push(path)
	}
	return out
}

if (import.meta.main) {
	const [boundariesPath, examplesDir] = process.argv.slice(2)
	if (!boundariesPath) {
		console.error(
			'usage: bun scripts/migrate-scope-css.ts <boundaries.json> [dir]',
		)
		process.exit(1)
	}
	const boundaries = JSON.parse(readFileSync(boundariesPath, 'utf8')) as Record<
		string,
		string[]
	>
	const root = examplesDir ?? new URL('../examples', import.meta.url).pathname
	let changed = 0
	for (const file of walk(root)) {
		const source = readFileSync(file, 'utf8')
		if (!source.includes('<style>')) continue
		const tag = basename(file).replace(/\.(tsx|tsrx)$/, '')
		const migrated = migrateSource(source, file, boundaries[tag] ?? [])
		if (migrated === source) continue
		writeFileSync(file, migrated)
		changed++
		console.log(`migrated ${file}`)
	}
	console.log(`${changed} source(s) migrated`)
}
