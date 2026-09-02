/**
 * Generated-file ↔ source-file span mapping (LT-011, ADR 0023 sub-design 6
 * amendment). `createVolarMappingsResult` demands a source map that covers
 * every source-AST token — an invariant only Ripple's own esrap-shaped
 * transforms satisfy (see the LT-004 probe). Our split compiler instead
 * records a SPARSE table: one entry per verbatim slice actually copied from
 * `.tsrx` source into a generated module. That is sufficient because TS
 * diagnostics only ever arise in CODE positions — setup statements,
 * reactive thunks, event handlers — and every code position lowers into
 * the generated module verbatim (never rewritten character-for-character,
 * only reindented). Template markup lowers into the SERVER half and never
 * produces a TS diagnostic, so it needs no coverage here.
 */

import { lineStartsInTemplate } from './indent'

/* === Types === */

/** One mapped range: `length` characters are byte-identical in both files. */
export type SourceSpan = {
	/** Character offset in the generated module. */
	generatedStart: number
	/** Character offset in the `.tsrx` source. */
	sourceStart: number
	length: number
}

/** A verbatim slice of `.tsrx` source embedded somewhere in a generated statement. */
export type SourceSlice = { text: string; start: number }

/** Running character offset into the generated lines built so far. */
export type SpanCursor = { offset: number }

/* === Internal Functions === */

/** Character offset where each line of `text` begins. */
const lineStarts = (text: string): number[] => {
	const starts = [0]
	for (let i = 0; i < text.length; i++)
		if (text.charCodeAt(i) === 10) starts.push(i + 1)
	return starts
}

/** `offset` within `text` (whose line-start table is `starts`) → {line, col}, 0-based. */
const offsetToLineCol = (
	starts: number[],
	offset: number,
): { line: number; col: number } => {
	let line = 0
	for (let i = 0; i < starts.length; i++) {
		if ((starts[i] as number) > offset) break
		line = i
	}
	return { line, col: offset - (starts[line] as number) }
}

/* === Exported Functions === */

/**
 * Re-indent a verbatim slice for generated code (LT-041, moved from
 * emit-server.ts so the reindentation family lives in one module): strip
 * the source's common indentation, apply `level` tabs (first line
 * included). Lines inside a multi-line template literal pass through
 * byte-identical — their leading whitespace is string content, not
 * indentation (LT-010). Unlike `appendWithSpans` below — which never
 * strips the first line (callers pass it already positioned) and whose
 * common-indent computation skips it — this variant computes `common` over
 * ALL significant lines and strips it from every line that starts with it.
 */
export const reindent = (slice: string, level: number): string => {
	const lines = slice.split('\n')
	const mask = lineStartsInTemplate(lines)
	const indents = lines
		.filter(
			(line, i) =>
				line.trim().length > 0 && !mask[i] && !line.trimStart().startsWith('*'),
		)
		.map(line => line.match(/^[ \t]*/)?.[0] ?? '')
	const common = indents.length
		? (indents.reduce((min, ind) => (ind.length < min.length ? ind : min)) ??
			'')
		: ''
	const prefix = '\t'.repeat(level)
	return lines
		.map((line, i) => {
			if (mask[i]) return line
			if (line.trim().length === 0) return ''
			return (
				prefix + (line.startsWith(common) ? line.slice(common.length) : line)
			)
		})
		.join('\n')
}

/**
 * Append `text` (already assembled, with any verbatim `slices` interpolated
 * into it) to `lines`, applying the module's reindent rule (see `reindent`
 * above for the precise difference: the FIRST line here is prefixed but
 * never stripped, and excluded from the common-indent computation — callers
 * pass it already positioned mid-line): continuation lines drop their
 * common leading indentation and gain `depth` tabs; lines that start inside
 * an open template literal pass through byte-identical (LT-010). While doing
 * so, record one `SourceSpan` per generated LINE each slice touches — a
 * slice's own internal reindent-induced offset shift is per-line, so a
 * single [start, start, length] tuple would be wrong across a line boundary.
 *
 * `cursor.offset` tracks the running character offset of `lines.join('\n')`;
 * callers add the module's fixed header length once after assembly (spans
 * are computed relative to the function/factory body, not the whole file).
 */
export const appendWithSpans = (
	lines: string[],
	text: string,
	depth: number,
	slices: readonly SourceSlice[],
	spans: SourceSpan[],
	cursor: SpanCursor,
): void => {
	const statementLines = text.split('\n')
	const mask = lineStartsInTemplate(statementLines)
	const rest = statementLines.slice(1)
	const indents = rest
		.filter((l, i) => l.trim().length > 0 && !mask[i + 1])
		.map(l => l.match(/^[ \t]*/)?.[0] ?? '')
	const common = indents.length
		? (indents.reduce((min, ind) => (ind.length < min.length ? ind : min)) ??
			'')
		: ''
	const prefix = '\t'.repeat(depth)

	const strippedOf: number[] = []
	const addedOf: string[] = []
	const outLines: string[] = []
	for (let i = 0; i < statementLines.length; i++) {
		const line = statementLines[i] as string
		if (i === 0) {
			strippedOf.push(0)
			addedOf.push(prefix)
			outLines.push(`${prefix}${line}`)
			continue
		}
		if (mask[i]) {
			strippedOf.push(0)
			addedOf.push('')
			outLines.push(line)
			continue
		}
		if (line.trim().length === 0) {
			strippedOf.push(line.length)
			addedOf.push('')
			outLines.push('')
			continue
		}
		const strip = line.startsWith(common)
			? common.length
			: line.length - line.trimStart().length
		strippedOf.push(strip)
		addedOf.push(prefix)
		outLines.push(`${prefix}${line.slice(strip)}`)
	}

	const genLineStart: number[] = []
	let running = cursor.offset
	for (const out of outLines) {
		genLineStart.push(running)
		running += out.length + 1
	}

	const srcStarts = lineStarts(text)
	let searchFrom = 0
	for (const slice of slices) {
		if (!slice.text) continue
		const idx = text.indexOf(slice.text, searchFrom)
		if (idx === -1) continue
		searchFrom = idx + slice.text.length
		const from = offsetToLineCol(srcStarts, idx)
		const to = offsetToLineCol(srcStarts, idx + slice.text.length)
		for (let li = from.line; li <= to.line; li++) {
			const lineText = statementLines[li] as string
			const colStart = li === from.line ? from.col : 0
			const colEnd = li === to.line ? to.col : lineText.length
			const stripped = strippedOf[li] as number
			if (colEnd <= stripped) continue
			const clippedStart = Math.max(colStart, stripped)
			const length = colEnd - clippedStart
			if (length <= 0) continue
			const genCol = (addedOf[li] as string).length + (clippedStart - stripped)
			const sliceOffset =
				(li === from.line ? 0 : (srcStarts[li] as number) - idx) +
				(clippedStart - colStart)
			spans.push({
				generatedStart: (genLineStart[li] as number) + genCol,
				sourceStart: slice.start + sliceOffset,
				length,
			})
		}
	}

	for (const out of outLines) lines.push(out)
	cursor.offset = running
}

/** 1-based {line, col} in `text` for a 0-based character `offset`. */
export const fileOffsetToLineCol = (
	text: string,
	offset: number,
): { line: number; col: number } => {
	const starts = lineStarts(text)
	const { line, col } = offsetToLineCol(starts, offset)
	return { line: line + 1, col: col + 1 }
}

/** 0-based character offset in `text` for a 1-based {line, col}. */
export const fileLineColToOffset = (
	text: string,
	line: number,
	col: number,
): number => {
	const starts = lineStarts(text)
	const lineStart = (starts[line - 1] as number | undefined) ?? text.length
	return lineStart + (col - 1)
}

/**
 * The span covering `offset`, or the nearest one starting before it (a
 * diagnostic can point just past a verbatim slice — a missing closing
 * paren reads as an error at the position right after the thunk).
 */
export const findSpanForGeneratedOffset = (
	spans: readonly SourceSpan[],
	offset: number,
): SourceSpan | null => {
	let best: SourceSpan | null = null
	for (const span of spans) {
		if (span.generatedStart > offset) continue
		if (!best || span.generatedStart > best.generatedStart) best = span
	}
	return best
}
