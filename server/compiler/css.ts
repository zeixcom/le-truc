/**
 * The component stylesheet as a compiler artifact (ADR 0033 s9, LT-268).
 *
 * The dedent gives way to a parse: `parseComponentSheet` parses the
 * `<style>` block's source with lightningcss — the `lightningcss-wasm`
 * distribution, the only one that loads under every JS runtime the
 * portability check runs (ADR 0038; the native napi binding cannot load
 * from a self-contained bundle) — and makes its rules, selectors and
 * at-rules reachable from the IR (`ComponentIR.sheet`). A sheet that does
 * not parse has no correct emission; a declaration outside its property's
 * grammar is equally dead in a sheet that ships as authored. Both are
 * tier 1 Prevented (ADR 0028 s1) through LTC064, with css-tree's lexer
 * arbitrating declaration grammar: lightningcss deliberately keeps unknown
 * properties and unparseable values instead of rejecting them, so its
 * parse alone cannot police the spec grammar, and its whole-sheet failures
 * cannot name the offending declaration the way a per-declaration check
 * can. css-tree reaches the nested blocks its own parser folds into Raw
 * nodes by recursing into their brace regions, which keeps every
 * declaration's authored position.
 *
 * The lightningcss pass is READ-ONLY: the visitor collects the parsed
 * sheet and returns nothing. Returning parsed nodes into the parser (the
 * write path a modified sheet would need) crashes on `var()` inside
 * nested rules at 1.33 — a Rust-side round-trip defect for scoped
 * emission (LT-304) to solve. The collected objects stay valid after
 * `transform` returns; nothing re-enters the parser.
 *
 * Emission is unchanged: the dedented verbatim text (`dedentCss`) is what
 * the build writes, byte-identical with the hand-written artifacts, until
 * LT-304 replaces it with the scoped emission.
 */

import type { CssNode, CssTreeDeclaration } from 'css-tree/dist/csstree.esm.js'
// The dist ESM bundle, not the package entry: the entry loads its
// dictionary patch through a runtime `createRequire`, which cannot ride
// the portability bundle's self-contained module graph (ADR 0038). The
// dist bundle inlines the same dictionary and runs under every JS
// runtime; its (loose) types come from the ambient shim `css-tree.d.ts`.
import {
	lexer,
	parse,
	parse as parseDeclarationList,
} from 'css-tree/dist/csstree.esm.js'
import type { StyleSheet } from 'lightningcss-wasm'
import { transform } from 'lightningcss-wasm'

/* === Types === */

/** What a sheet error says is wrong. */
export type SheetErrorFace =
	/** The sheet does not parse (lightningcss refused it). */
	| 'syntax'
	/** A declaration names a property the CSS grammar does not define. */
	| 'unknown-property'
	/** A declaration's value is outside its property's grammar. */
	| 'invalid-value'

/** One spec-grammar finding over the authored sheet. */
export type SheetError = {
	face: SheetErrorFace
	/**
	 * 0-based offset within the sheet text, when the parser knows it —
	 * the caller maps it onto the authored source.
	 */
	offset?: number
	/** The offending property, for the declaration faces. */
	property?: string
	/** The echoed value text, for the invalid-value face. */
	value?: string
	/** The parser's own wording, for the message body. */
	detail: string
}

export type ParsedComponentSheet = {
	/** The parsed sheet, or null when it does not parse (or is absent). */
	sheet: StyleSheet | null
	/** Every grammar finding; empty for a valid sheet. */
	errors: SheetError[]
}

/* === Internal Functions === */

/**
 * Offset of a 1-based lightningcss `loc` position within the sheet text.
 */
const lineColToOffset = (source: string, line: number, column: number) => {
	let offset = 0
	for (let i = 1; i < line; i++) {
		const next = source.indexOf('\n', offset)
		if (next === -1) return source.length
		offset = next + 1
	}
	return Math.min(source.length, offset + Math.max(0, column - 1))
}

/** First line of a parser message — the detail never spans lines. */
const firstLine = (message: string): string => message.split('\n')[0] ?? ''

/** css-tree node children, iterating its List (or plain array) shape. */
const childrenOf = (node: CssNode): CssNode[] => {
	const children = (node as { children?: Iterable<CssNode> }).children
	return children ? [...children].filter(Boolean) : []
}

/** A `var()`/`env()` reference anywhere in a value's component tree. */
const mentionsSubstitution = (node: CssNode | undefined): boolean =>
	!!node &&
	(node.type === 'Function' && /^(var|env)$/i.test(String(node.name))
		? true
		: childrenOf(node).some(mentionsSubstitution))

/**
 * The inner text of every top-level `{…}` region of a Raw node's value —
 * a nested rule under css-tree's pre-nesting grammar. String, comment and
 * (unclosed-group safe) paren aware; lightningcss has already accepted the
 * sheet's syntax, so the scan never sees text a browser could not.
 */
const nestedBlockRegions = (text: string): Array<[number, number]> => {
	const regions: Array<[number, number]> = []
	let depth = 0
	let start = -1
	for (let i = 0; i < text.length; i++) {
		const ch = text[i]
		if (ch === '"' || ch === "'") {
			const quote = ch
			i++
			while (i < text.length && text[i] !== quote) {
				if (text[i] === '\\') i++
				i++
			}
			continue
		}
		if (text.startsWith('/*', i)) {
			const end = text.indexOf('*/', i + 2)
			if (end === -1) break
			i = end + 1
			continue
		}
		if (ch === '{') {
			if (depth === 0) start = i
			depth++
		} else if (ch === '}') {
			if (depth > 0 && --depth === 0 && start >= 0) {
				regions.push([start + 1, i])
				start = -1
			}
		}
	}
	return regions
}

const MAX_VALUE_ECHO = 60

/**
 * The declaration-grammar pass. css-tree parses the sheet (positions on,
 * its pre-nesting grammar folding nested rules into positioned Raw nodes
 * that the region recursion re-enters) and `lexer.matchDeclaration` — the
 * per-declaration entry, which resolves vendor and hack prefixes — checks
 * each rule-block declaration against the CSS dictionary. Exempt, never
 * errors: custom properties (any value is valid by spec), values
 * referencing `var()`/`env()` (matching needs substitution), whole Raw
 * values (nothing decidable), and every declaration inside an at-rule
 * block (`@font-face`/`@property` descriptors are not properties). A
 * css-tree parse failure means no declaration check — lightningcss is the
 * syntax authority and has already passed the sheet.
 */
const grammarErrors = (source: string): SheetError[] => {
	const errors: SheetError[] = []
	let ast: CssNode
	try {
		ast = parse(source, { positions: true })
	} catch {
		return errors
	}

	const checkDeclaration = (node: CssTreeDeclaration, base: number): void => {
		const property = String(node.property)
		if (property.startsWith('--')) return
		const value = node.value as CssNode | undefined
		if (!value || value.type === 'Raw' || mentionsSubstitution(value)) return
		const match = lexer.matchDeclaration(node)
		if (match.matched !== null) return
		const message = String(match.error?.message ?? '')
		const unknown = message.startsWith('Unknown property')
		let echoed: string | undefined
		if (!unknown && value.loc) {
			// The value's offsets are relative to the (re-parsed) text the
			// declaration sits in; `base` lifts them into the sheet.
			echoed = source
				.slice(base + value.loc.start.offset, base + value.loc.end.offset)
				.trim()
			if (echoed.length > MAX_VALUE_ECHO)
				echoed = `${echoed.slice(0, MAX_VALUE_ECHO)}…`
		}
		errors.push({
			face: unknown ? 'unknown-property' : 'invalid-value',
			offset: base + (node.loc?.start.offset ?? 0),
			property,
			...(echoed !== undefined ? { value: echoed } : {}),
			detail: unknown ? message : 'Mismatch',
		})
	}

	const visit = (node: CssNode, base: number, inAtrule: boolean): void => {
		switch (node.type) {
			case 'Rule':
				if ((node as { block?: CssNode }).block)
					visit((node as { block: CssNode }).block, base, false)
				return
			case 'Atrule': {
				const block = (node as { block?: CssNode }).block
				if (block) visit(block, base, true)
				return
			}
			case 'Declaration':
				if (!inAtrule) checkDeclaration(node as CssTreeDeclaration, base)
				return
			case 'Raw': {
				const raw = String((node as { value?: unknown }).value ?? '')
				const rawStart = node.loc?.start.offset ?? 0
				for (const [from, to] of nestedBlockRegions(raw)) {
					try {
						const inner = parseDeclarationList(raw.slice(from, to), {
							positions: true,
							context: 'declarationList',
						})
						visit(inner, base + rawStart + from, inAtrule)
					} catch {
						// A region css-tree cannot read gets no declaration check.
					}
				}
				return
			}
			default:
				for (const child of childrenOf(node)) visit(child, base, inAtrule)
		}
	}
	visit(ast, 0, false)
	return errors
}

/* === Exported Functions === */

/**
 * Parse a `<style>` block's source text (ADR 0033 s9). The lightningcss
 * pass collects the sheet read-only; its syntax failures report as the
 * `syntax` face and leave no sheet. The css-tree pass then reports
 * declaration-grammar findings. Neither face changes the emitted text —
 * the dedent below stays the emission source until LT-304.
 */
export const parseComponentSheet = (source: string): ParsedComponentSheet => {
	let captured: StyleSheet | undefined
	try {
		transform({
			code: new TextEncoder().encode(source) as Buffer,
			filename: 'stylesheet.css',
			// Read-only: never return nodes into the parser (see module doc).
			visitor: {
				StyleSheet(sheet) {
					captured = sheet
				},
			},
		})
	} catch (error) {
		const err = error as {
			message: string
			loc?: { line: number; column: number }
		}
		const offset =
			err.loc?.line !== undefined && err.loc?.column !== undefined
				? lineColToOffset(source, err.loc.line, err.loc.column)
				: undefined
		return {
			sheet: null,
			errors: [
				{
					face: 'syntax',
					...(offset !== undefined ? { offset } : {}),
					detail: firstLine(err.message),
				},
			],
		}
	}
	if (!captured) return { sheet: null, errors: [] }
	return { sheet: captured, errors: grammarErrors(source) }
}

/**
 * Normalize a `<style>` block's `stylesheet.source` to standalone CSS:
 * strip the common leading indentation from every non-blank line, drop
 * leading/trailing blank lines, and end with exactly one newline.
 *
 * Still the emission source (LT-268 changes no output); LT-304's scoped
 * emission renders from the parsed sheet instead.
 */
export const dedentCss = (source: string): string => {
	const lines = source.split('\n')
	const indents = lines
		.filter(line => line.trim().length > 0)
		.map(line => line.match(/^[ \t]*/)?.[0] ?? '')
	const common = indents.length
		? (indents.reduce((min, ind) => (ind.length < min.length ? ind : min)) ??
			'')
		: ''
	const stripped = lines.map(line =>
		line.startsWith(common) ? line.slice(common.length) : line.trimStart(),
	)
	// Trim fully-blank lines at both ends, keep interior structure verbatim
	while (stripped.length && stripped[0]?.trim() === '') stripped.shift()
	while (stripped.length && stripped.at(-1)?.trim() === '') stripped.pop()
	return stripped.length ? `${stripped.join('\n')}\n` : ''
}
