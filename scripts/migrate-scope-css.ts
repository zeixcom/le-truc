/**
 * The shadow-root → authored `@scope` codemod (LT-501, ADR 0033).
 *
 * Every compiled corpus stylesheet moves from the shadow-root authored form
 * (`:host { … }` plus bare rules, scope boundaries derived from the
 * template) to platform CSS: the scoped rules sit in a prelude-less
 * `@scope { … }` block, `:scope` is the host, and the limits are written
 * out. A sheet means what the same sheet would mean as an inline `<style>`
 * in the host; the compiler derives nothing.
 *
 * 	bun scripts/migrate-scope-css.ts <boundaries.json> [examples-dir]
 *
 * `<boundaries.json>` maps each component tag to the custom-element tags
 * the retired emission stopped its scope at (every custom element the
 * lowered template rendered). The codemod writes them as the block's
 * limits, `to (<tag> > *, …)`, so the migrated sheet reaches exactly what
 * the old emission reached. The set is read once, before the derived
 * boundaries were removed; the flag-free way to shrink the limits is a
 * leak check on the migrated sheet, not this script.
 *
 * Per compiled source (`.tsx` `<style>{css`…`}</style>`, `.tsrx`
 * `<style>…</style>`; the `.ts` twins keep their hand-written `.css`),
 * rewriting rule TEXT only — values, comments and nesting never move:
 *
 * 1. `@keyframes`, `@font-face`, `@property` and the other hoisted
 *    at-rules stay at the top level;
 * 2. `:global(<selector>) { … }` and the bare `:global { … }` block unwrap
 *    to top-level rules;
 * 3. everything else moves into one `@scope [to (…)] { … }` block, with
 *    `:host` → `:scope` and `:host(X)` → `:scope:is(X)`.
 *
 * The retired emission placed hoisted and unwrapped rules first, then the
 * scoped remainder. The codemod keeps that order, so the cascade is the
 * one the corpus had.
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

/** A top-level rule with the comments and blank lines that lead it. */
type Piece = {
	/** Text from the previous rule's end through this rule's end. */
	text: string
	/** The selector or at-rule prelude, comments removed. */
	prelude: string
	/** Where the selector (or at-rule) starts within `text`, past leading comments. */
	selector: number
	/** The `{` offset within `text`. */
	brace: number
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

/** The top-level rules of a sheet; blockless statements ride the next rule. */
const piecesOf = (sheet: string): { pieces: Piece[]; rest: string } => {
	const pieces: Piece[] = []
	let cursor = 0
	let i = 0
	while (i < sheet.length) {
		const brace = indexOfCode(sheet, '{', i)
		if (brace === -1) break
		const semicolon = indexOfCode(sheet, ';', i)
		if (semicolon !== -1 && semicolon < brace) {
			i = semicolon + 1
			continue
		}
		const close = matching(sheet, brace)
		if (close === -1) break
		const raw = sheet.slice(cursor, close + 1)
		const text = raw.replace(/^\s*\n/, '')
		pieces.push({
			text,
			prelude: stripComments(sheet.slice(i, brace)).trim(),
			selector: skipTrivia(sheet, cursor) - cursor - (raw.length - text.length),
			brace: brace - cursor - (raw.length - text.length),
		})
		cursor = close + 1
		i = cursor
	}
	return { pieces, rest: sheet.slice(cursor) }
}

/* --- the rewrite --- */

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

/** `:host` → `:scope`, `:host(X)` → `:scope:is(X)`; `:host-context` is left. */
const hostToScope = (text: string): string => {
	let out = ''
	let i = 0
	while (i < text.length) {
		const c = text[i] as string
		if (c === '"' || c === "'") {
			const end = skipString(text, i)
			out += text.slice(i, end + 1)
			i = end + 1
		} else if (
			text.startsWith(':host', i) &&
			!/[\w-]/.test(text[i + 5] ?? '')
		) {
			if (text[i + 5] === '(') {
				const close = matching(text, i + 5)
				if (close !== -1) {
					out += `:scope:is(${text.slice(i + 6, close).trim()})`
					i = close + 1
					continue
				}
			}
			out += ':scope'
			i += 5
		} else {
			out += c
			i++
		}
	}
	return out
}

/** The text with the common leading indentation removed. */
const dedent = (text: string): string => {
	const lines = text.split('\n')
	const indents = lines
		.filter(line => line.trim() !== '')
		.map(line => line.match(/^[ \t]*/)?.[0] ?? '')
	const common = indents.reduce(
		(min, indent) => (indent.length < min.length ? indent : min),
		indents[0] ?? '',
	)
	return lines.map(line => line.slice(common.length)).join('\n')
}

const indentBy = (text: string, indent: string): string =>
	text
		.split('\n')
		.map(line => (line.trim() === '' ? '' : `${indent}${line}`))
		.join('\n')

/** `:global(<selector>) { … }` members, unwrapped; null when not a global rule. */
const unwrapGlobalRule = (piece: Piece): string | null => {
	if (!piece.prelude.startsWith(':global')) return null
	// The comments that led the rule stay with it.
	const comments = piece.text.slice(0, piece.selector)
	const body = piece.text.slice(piece.brace)
	// The bare block: its content is a list of top-level rules.
	if (piece.prelude === ':global')
		return `${comments}${dedent(body.slice(1, body.lastIndexOf('}'))).trim()}`.trim()
	const members = splitCommas(piece.prelude).map(member => {
		const trimmed = member.trim()
		if (!trimmed.startsWith(':global(')) return trimmed
		const close = matching(trimmed, ':global'.length)
		return close === -1
			? trimmed
			: trimmed.slice(':global('.length, close).trim()
	})
	return `${comments}${members.join(', ')} ${body}`.trim()
}

/** Migrate one stylesheet's text; `boundaries` become the block's limits. */
export const migrateSheet = (
	sheet: string,
	boundaries: readonly string[],
): string => {
	const leadMatch = /^[ \t]*\n/.exec(sheet)
	const prefix = leadMatch ? leadMatch[0] : ''
	const firstContent = sheet.slice(prefix.length)
	const base = firstContent.match(/^[ \t]*/)?.[0] ?? ''
	const trimmedEnd = firstContent.trimEnd()
	const suffix = firstContent.slice(trimmedEnd.length)
	const body = dedent(`${base}${firstContent.trimStart()}`.trimEnd())
	const { pieces, rest } = piecesOf(body)
	if (pieces.some(piece => piece.prelude.startsWith('@scope'))) return sheet
	const top: string[] = []
	const scoped: string[] = []
	for (const piece of pieces) {
		const at = /^@([a-zA-Z-]+)/.exec(piece.prelude)?.[1]
		if (at && HOISTED.has(at)) top.push(piece.text.trim())
		else {
			const unwrapped = unwrapGlobalRule(piece)
			if (unwrapped !== null) top.push(unwrapped)
			else scoped.push(hostToScope(piece.text.trim()))
		}
	}
	if (rest.trim() !== '') scoped.push(rest.trim())
	const limits = boundaries.length
		? ` to (${boundaries.map(tag => `${tag} > *`).join(', ')})`
		: ''
	const parts = [...top]
	if (scoped.length > 0)
		parts.push(`@scope${limits} {\n${indentBy(scoped.join('\n\n'), '\t')}\n}`)
	const reindented = indentBy(parts.join('\n\n'), base)
	// `indentBy` blanks whitespace-only lines; the first line carries `base`
	// through the prefix text the template literal kept.
	return `${prefix}${reindented}${suffix}`
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
