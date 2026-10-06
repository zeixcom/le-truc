/**
 * LT-465 spike prototype — style scope for parent-owned children (shape (a)
 * of the spike: a second scope root at the insertion point). NOT production
 * code: it post-processes `emitScopedSheet`'s output text so the fixtures in
 * `children-scope.test.ts` and the browser probe under
 * `spike/children-scope/` can measure the shape before ADR 0048 decides it.
 *
 * The model. The server marks the element enclosing a `{children}`
 * insertion with `data-children="<owner-tag>"` — the tag of the component
 * whose compose site passed the content, only when a compiled parent is
 * that owner (a page-rendered instance carries no marker, so its rules
 * keep reaching page-authored children, ADR 0033 s7). Two additions to
 * every scope then give the ownership:
 *
 * 1. **The foreign region is a boundary.** `[data-children]:not([data-children="T"])`
 *    joins T's boundary set, so T's rules stop at a region another
 *    component owns — the child-side half: the child's scope ends at its
 *    own insertion point (the marked element itself stays the child's).
 * 2. **T's own regions are re-included.** Native: one more
 *    `@scope ([data-children="T"]) to (<boundaries> > *)` block, its rules
 *    in the lowered form (`:where(T) S`, ancestors outside the region still
 *    match) with the subject anchored `:where(:scope *)` — an explicit
 *    `:scope` lifts the implicit `:scope ` prefix that would otherwise cut
 *    every ancestor compound off; rules whose subject is the host are
 *    dropped. Lowered: no second copy — the guard grows a re-include
 *    clause, `:not(:is(B):not(:is(R):not(:is(BR))))`.
 *
 * Every addition sits inside `:where()`, so specificity is untouched in
 * both emissions.
 */
import { parseComponentSheet } from '../../compiler/css'
import { emitScopedSheet } from '../../compiler/css-scope'
import type { CssTargets } from '../../compiler/emit-paths'

export const MARKER = 'data-children'

/** The pseudo-boundary every scope of `tag` stops at: a region another tag owns. */
export const foreignRegion = (tag: string): string =>
	`[${MARKER}]:not([${MARKER}="${tag}"])`

const ownRegion = (tag: string): string => `[${MARKER}="${tag}"]`

/** What the spike measures per component. */
export type ChildrenScope = {
	/** The template has a `{children}` insertion — its scope stops there. */
	inserts: boolean
	/** The template composes a child WITH children — it owns a region. */
	owns: boolean
}

const parse = (sheetText: string): unknown => {
	const { sheet, errors } = parseComponentSheet(sheetText)
	if (!sheet || errors.length)
		throw new Error(`spike fixture sheet does not parse: ${sheetText}`)
	return sheet
}

const guardList = (tag: string, boundaries: readonly string[]): string =>
	boundaries.flatMap(b => [`${tag} ${b} > *`, `${tag} ${b} > * *`]).join(', ')

/**
 * Shape (a), lowered: one copy, the guard rewritten so T's own regions
 * re-enter the scope (minus boundaries inside them).
 */
const lowered = (
	sheetText: string,
	tag: string,
	boundaries: readonly string[],
	cssTargets: CssTargets,
	scope: ChildrenScope,
): string => {
	const all = scope.inserts ? [...boundaries, foreignRegion(tag)] : boundaries
	const out = emitScopedSheet(parse(sheetText), sheetText, tag, all, cssTargets)
	if (!scope.owns || all.length === 0) return out
	const list = guardList(tag, all)
	const region = ownRegion(tag)
	const inner = all
		.flatMap(b => [`${region} ${b} > *`, `${region} ${b} > * *`])
		.join(', ')
	return out
		.split(`:where(:not(${list}))`)
		.join(`:where(:not(:is(${list}):not(:is(${region} *):not(:is(${inner})))))`)
}

/* --- native: the region block --- */

type Block = { prelude: string; body: string; start: number; end: number }

/** Top-level `prelude { body }` blocks of a flat (already-lowered) sheet. */
const blocksOf = (text: string): Block[] => {
	const blocks: Block[] = []
	let i = 0
	while (i < text.length) {
		const open = text.indexOf('{', i)
		if (open === -1) break
		let depth = 1
		let j = open + 1
		while (j < text.length && depth > 0) {
			if (text[j] === '{') depth++
			else if (text[j] === '}') depth--
			j++
		}
		blocks.push({
			prelude: text.slice(i, open).trim(),
			body: text.slice(open + 1, j - 1),
			start: i,
			end: j,
		})
		i = j
	}
	return blocks
}

const splitTopLevel = (text: string, separator: ','): string[] => {
	const parts: string[] = []
	let depth = 0
	let from = 0
	for (let i = 0; i < text.length; i++) {
		const ch = text[i]
		if (ch === '(') depth++
		else if (ch === ')') depth--
		else if (ch === separator && depth === 0) {
			parts.push(text.slice(from, i).trim())
			from = i + 1
		}
	}
	parts.push(text.slice(from).trim())
	return parts
}

const PSEUDO_ELEMENT =
	/(::?(?:before|after|first-line|first-letter)|::[\w-]+(?:\([^)]*\))?)$/

/** The part's subject is the host: nothing but the host compound and pseudos. */
const hostSubject = (part: string, tag: string): boolean => {
	if (!part.startsWith(`:where(${tag}`)) return false
	let depth = 0
	for (let i = 0; i < part.length; i++) {
		const ch = part[i]
		if (ch === '(') depth++
		else if (ch === ')') depth--
		else if (
			depth === 0 &&
			(ch === ' ' || ch === '>' || ch === '+' || ch === '~')
		)
			return false
	}
	return true
}

/** Anchor the subject in the region: `:where(:scope *)` before any pseudo-element. */
const anchored = (part: string): string => {
	const m = PSEUDO_ELEMENT.exec(part)
	const at = m ? m.index : part.length
	return `${part.slice(0, at)}:where(:scope *)${part.slice(at)}`
}

const regionRules = (text: string, tag: string): string =>
	blocksOf(text)
		.flatMap(block => {
			if (block.prelude.startsWith('@')) {
				if (!/^@(media|supports|container|layer)\b/.test(block.prelude))
					return [] // hoisted: @keyframes/@font-face/@property
				const inner = regionRules(block.body, tag)
				return inner ? [`${block.prelude} {\n${inner}\n}`] : []
			}
			const parts = splitTopLevel(block.prelude, ',')
			if (!parts.some(p => p.startsWith(`:where(${tag}`))) return [] // :global
			const kept = parts.filter(p => !hostSubject(p, tag)).map(anchored)
			return kept.length ? [`${kept.join(', ')} {${block.body}}`] : []
		})
		.join('\n\n')

const native = (
	sheetText: string,
	tag: string,
	boundaries: readonly string[],
	cssTargets: CssTargets,
	scope: ChildrenScope,
): string => {
	const all = scope.inserts ? [...boundaries, foreignRegion(tag)] : boundaries
	const sheet = parse(sheetText)
	const main = emitScopedSheet(sheet, sheetText, tag, all, cssTargets)
	if (!scope.owns) return main
	// The lowered form without guards: `:where(T) S`, hoisted rules verbatim.
	const flat = emitScopedSheet(sheet, sheetText, tag, [], {})
	const rules = regionRules(flat, tag)
	if (!rules) return main
	const limit = all.length ? ` to (${all.map(b => `${b} > *`).join(', ')})` : ''
	return `${main}\n@scope (${ownRegion(tag)})${limit} {\n${rules}\n}\n`
}

/**
 * Emit `sheetText` for `tag` under shape (a). `mode` follows the targets,
 * as `emitScopedSheet` does.
 */
export const emitChildrenScoped = (
	sheetText: string,
	tag: string,
	boundaries: readonly string[],
	cssTargets: CssTargets,
	mode: 'native' | 'lowered',
	scope: ChildrenScope,
): string =>
	mode === 'native'
		? native(sheetText, tag, boundaries, cssTargets, scope)
		: lowered(sheetText, tag, boundaries, cssTargets, scope)
