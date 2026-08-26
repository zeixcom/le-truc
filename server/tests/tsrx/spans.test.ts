/**
 * Unit tests for the LT-011 span table (ADR 0023 sub-design 6 amendment,
 * stage 1): `appendWithSpans` records generated-file ↔ source-file offsets
 * for verbatim slices (setup statements, thunks, handlers), and
 * `check:tsrx` uses `fileLineColToOffset`/`fileOffsetToLineCol`/
 * `findSpanForGeneratedOffset` to remap a tsc diagnostic through them.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'
import {
	appendWithSpans,
	fileLineColToOffset,
	fileOffsetToLineCol,
	findSpanForGeneratedOffset,
	type SourceSpan,
} from '../../tsrx/spans'

describe('appendWithSpans', () => {
	test('a single-line slice maps 1:1 once the depth prefix is skipped', () => {
		const lines: string[] = []
		const spans: SourceSpan[] = []
		const cursor = { offset: 0 }
		const source = 'watch(() => count.get() + 1, bindText(span))'
		appendWithSpans(
			lines,
			source,
			2,
			[{ text: '() => count.get() + 1', start: 100 }],
			spans,
			cursor,
		)
		expect(lines).toEqual([`\t\t${source}`])
		expect(spans).toHaveLength(1)
		const span = spans[0] as SourceSpan
		// 2 tabs + 'watch(' = 8 chars before the slice starts.
		expect(span.generatedStart).toBe(2 + 'watch('.length)
		expect(span.sourceStart).toBe(100)
		expect(span.length).toBe('() => count.get() + 1'.length)
	})

	test('cursor advances across multiple appended statements', () => {
		const lines: string[] = []
		const spans: SourceSpan[] = []
		const cursor = { offset: 0 }
		appendWithSpans(lines, 'const a = 1', 1, [], spans, cursor)
		appendWithSpans(
			lines,
			'const b = 2',
			1,
			[{ text: 'b = 2', start: 50 }],
			spans,
			cursor,
		)
		const joined = lines.join('\n')
		const span = spans[0] as SourceSpan
		expect(
			joined.slice(span.generatedStart, span.generatedStart + span.length),
		).toBe('b = 2')
	})

	test('a multi-line slice maps per-line, surviving reindent', () => {
		const lines: string[] = []
		const spans: SourceSpan[] = []
		const cursor = { offset: 0 }
		// Slice as authored (4-space indented continuation) vs. depth-1 reindent.
		const slice = 'handler(a,\n    b)'
		appendWithSpans(
			lines,
			`on(el, 'click', ${slice})`,
			1,
			[{ text: slice, start: 200 }],
			spans,
			cursor,
		)
		expect(spans).toHaveLength(2)
		const generated = lines.join('\n')
		const [first, second] = spans as [SourceSpan, SourceSpan]
		expect(
			generated.slice(
				first.generatedStart,
				first.generatedStart + first.length,
			),
		).toBe('handler(a,')
		expect(
			generated.slice(
				second.generatedStart,
				second.generatedStart + second.length,
			),
		).toBe('b)')
		// The second line's source offset skips past the stripped indentation
		// and the first line's content + newline in the ORIGINAL slice text.
		expect(second.sourceStart).toBe(200 + 'handler(a,\n    '.length)
	})

	test('lines inside a template literal pass through untouched (LT-010)', () => {
		const lines: string[] = []
		const spans: SourceSpan[] = []
		const cursor = { offset: 0 }
		const slice = 'bindText(`line one\n\t\tstill indented`)'
		appendWithSpans(
			lines,
			`watch(x, ${slice})`,
			1,
			[{ text: slice, start: 0 }],
			spans,
			cursor,
		)
		expect(lines[1]).toBe('\t\tstill indented`))')
	})
})

describe('fileOffsetToLineCol / fileLineColToOffset', () => {
	test('round-trips across multiple lines', () => {
		const text = 'const a = 1\nconst b = 2\nconst c = 3'
		const offset = text.indexOf('b = 2')
		const { line, col } = fileOffsetToLineCol(text, offset)
		expect(line).toBe(2)
		expect(col).toBe('const '.length + 1)
		expect(fileLineColToOffset(text, line, col)).toBe(offset)
	})
})

describe('findSpanForGeneratedOffset', () => {
	const first: SourceSpan = { generatedStart: 10, sourceStart: 100, length: 5 }
	const second: SourceSpan = { generatedStart: 30, sourceStart: 300, length: 5 }
	const spans: SourceSpan[] = [first, second]

	test('picks the covering span', () => {
		expect(findSpanForGeneratedOffset(spans, 12)).toEqual(first)
		expect(findSpanForGeneratedOffset(spans, 32)).toEqual(second)
	})

	test('falls back to the nearest span before an offset past its end', () => {
		expect(findSpanForGeneratedOffset(spans, 20)).toEqual(first)
	})

	test('returns null before any recorded span', () => {
		expect(findSpanForGeneratedOffset(spans, 0)).toBeNull()
	})
})

describe('integration — emitClientModule spans locate the authored thunk', () => {
	test('a reactive attribute thunk maps back to its .tsrx source position', () => {
		const source = `export function C({ start = 0 }: { start?: number })
	@{
		const count = createCell(start)
		expose({ count: count.get })
		<>
			<c-el>
				<button type="button" onClick={() => count.set(count.get() + 1)}>
					{count}
				</button>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		if (!component) throw new Error('fixture must compile')
		const handlerText = '() => count.set(count.get() + 1)'
		const generatedIdx = component.clientCode.indexOf(handlerText)
		expect(generatedIdx).toBeGreaterThan(-1)
		const span = findSpanForGeneratedOffset(component.clientSpans, generatedIdx)
		expect(span).not.toBeNull()
		const mapped = source.slice(
			(span as SourceSpan).sourceStart,
			(span as SourceSpan).sourceStart + (span as SourceSpan).length,
		)
		expect(handlerText.startsWith(mapped)).toBe(true)
		expect(source.indexOf(handlerText)).toBe((span as SourceSpan).sourceStart)
	})
})
