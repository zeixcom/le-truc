/**
 * The shared code-generation kit (LT-234): what both emitters use to write
 * generated TypeScript. Three parts, one rule each.
 *
 * - `jsString()` / `jsTemplate()` are THE sanctioned ways to put an author
 *   string into generated source: a string literal, or a template literal
 *   whose static segments are escaped and whose interpolations are code. Raw
 *   `'${author}'` interpolation is a syntax error at best and a source
 *   injection at worst (review §1.2/§1.3, point-fixed by LT-221).
 * - `HtmlWriter` collects one push argument's HTML: static markup (with
 *   attribute values HTML-escaped) and code expressions, rendered through
 *   `jsTemplate()`.
 * - `CodeBuilder` owns a generated block's lines, its indentation depth and
 *   the running character offset its span table is recorded against, so a
 *   caller never hand-manages a tab prefix or a `cursor.offset`.
 *
 * Pure string computation: no pipeline types, no runtime values beyond the
 * `spans.ts` reindent/span helpers. The kit's fourth part, `commonIndent()`,
 * lives in `indent.ts` beside the line classification it consumes.
 */

import {
	appendWithSpans,
	type SourceSlice,
	type SourceSpan,
	type SpanCursor,
} from './spans'

/* === Types === */

/**
 * One segment of a template literal: escaped static text, or a code
 * expression. Not a **Hole** (CONTEXT.md, ADR 0043) — that is a request-time
 * template-target position with an escaping context; this is generated JS.
 */
export type TemplatePart = { static: string } | { expr: string }

/* === Internal Functions === */

/** Plain printable ASCII without `'` or `\`: safe inside single quotes. */
const JS_PLAIN_STRING = /^[\x20-\x26\x28-\x5b\x5d-\x7e]*$/

/** Escape a static segment for use inside a generated template literal. */
const templateEscape = (s: string): string =>
	s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

/** Escape a static attribute value for a double-quoted HTML attribute. */
const escapeAttrValue = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')

/* === Exported Functions === */

/**
 * A JS string literal for `value`. The default `'single'` form keeps plain
 * printable ASCII in single quotes and JSON-quotes everything else (a JSON
 * string literal IS a JS string literal); `'double'` is always JSON-quoted.
 * Both are sound for every input — the choice only fixes the bytes.
 */
export const jsString = (
	value: string,
	quote: 'single' | 'double' = 'single',
): string =>
	quote === 'single' && JS_PLAIN_STRING.test(value)
		? `'${value}'`
		: JSON.stringify(value)

/**
 * A JS template literal over `parts`: static segments escaped, code
 * expressions interpolated. A parts list with no expression is a plain
 * double-quoted string.
 */
export const jsTemplate = (parts: readonly TemplatePart[]): string => {
	if (parts.every(p => 'static' in p))
		return jsString(
			parts.map(p => (p as { static: string }).static).join(''),
			'double',
		)
	const body = parts
		.map(p => ('static' in p ? templateEscape(p.static) : `\${${p.expr}}`))
		.join('')
	return `\`${body}\``
}

/** A structured data literal (arrays, records) — JSON is valid JS. */
export const jsData = (value: unknown): string => JSON.stringify(value)

/** Whether `name` can be written as a bare identifier / dot member. */
export const isJsIdentifier = (name: string): boolean =>
	/^[A-Za-z_$][\w$]*$/.test(name)

/* === Classes === */

/**
 * One push argument's HTML (LT-234, generalising the server emitter's
 * `Part[]`): static markup and code expressions in order, rendered with
 * `jsTemplate()`. `attr()` HTML-escapes a static attribute value; `expr()`
 * takes generated code whose RESULT is markup (the harness's `attr()`,
 * `esc()` and friends escape at render time).
 */
export class HtmlWriter {
	readonly #parts: TemplatePart[] = []

	/**
	 * Static markup, verbatim. Adjacent static segments merge, so a `$` and
	 * a `{` written apart are still escaped as one `${`.
	 */
	static(markup: string): this {
		const last = this.#parts.at(-1)
		if (last && 'static' in last) last.static += markup
		else this.#parts.push({ static: markup })
		return this
	}

	/** A static attribute: bare when `value` is null, else escaped. */
	attr(name: string, value: string | null): this {
		return this.static(
			value === null ? ` ${name}` : ` ${name}="${escapeAttrValue(value)}"`,
		)
	}

	/** A static attribute value fragment, HTML-escaped. */
	text(value: string): this {
		return this.static(escapeAttrValue(value))
	}

	/** A code expression whose value is markup. */
	expr(expr: string): this {
		this.#parts.push({ expr })
		return this
	}

	/** The code expressions, in order. */
	get exprs(): string[] {
		return this.#parts.flatMap(p => ('expr' in p ? [p.expr] : []))
	}

	/** The JS expression for this markup. */
	toString(): string {
		return jsTemplate(this.#parts)
	}
}

/**
 * A generated block's lines, its indentation depth and its span table
 * (LT-234). `line()` writes one statement at the current depth; `open()` /
 * `close()` / `between()` move the depth around a braced block, so no caller
 * computes a tab prefix. The character offset spans are recorded against is
 * kept as an invariant of every write, never by hand.
 *
 * In `reindent` mode a multi-line statement's continuation lines drop their
 * common indentation and take the current depth, and verbatim `slices` are
 * span-recorded (`appendWithSpans`); otherwise a statement's continuation
 * lines pass through as written.
 */
export class CodeBuilder {
	readonly lines: string[] = []
	readonly spans: SourceSpan[] = []
	readonly #cursor: SpanCursor = { offset: 0 }
	readonly #reindent: boolean
	depth: number

	constructor(options: { depth?: number; reindent?: boolean } = {}) {
		this.depth = options.depth ?? 0
		this.#reindent = options.reindent ?? false
	}

	/** Offset of `lines.join('\n')`'s next line: where the next write starts. */
	get offset(): number {
		return this.#cursor.offset
	}

	/** One statement at the current depth. */
	line(text: string, slices: readonly SourceSlice[] = []): this {
		if (this.#reindent)
			appendWithSpans(
				this.lines,
				text,
				this.depth,
				slices,
				this.spans,
				this.#cursor,
			)
		else this.#push(`${'\t'.repeat(this.depth)}${text}`)
		return this
	}

	/** A statement that opens a block; the block's body is one level deeper. */
	open(text: string, slices: readonly SourceSlice[] = []): this {
		this.line(text, slices)
		this.depth++
		return this
	}

	/** Close the current block with `text`, one level shallower. */
	close(text = '}'): this {
		this.depth--
		return this.line(text)
	}

	/** A line at the enclosing depth between two block bodies (`} else {`). */
	between(text: string): this {
		this.depth--
		this.line(text)
		this.depth++
		return this
	}

	/** An empty builder at this one's depth and mode, for deferred output. */
	fork(): CodeBuilder {
		return new CodeBuilder({ depth: this.depth, reindent: this.#reindent })
	}

	/**
	 * Append another builder's output (or pre-formatted lines), rebasing its
	 * spans onto this builder's offset.
	 */
	append(other: CodeBuilder | readonly string[]): this {
		const base = this.#cursor.offset
		if (other instanceof CodeBuilder)
			for (const span of other.spans)
				this.spans.push({ ...span, generatedStart: span.generatedStart + base })
		for (const line of other instanceof CodeBuilder ? other.lines : other)
			this.#push(line)
		return this
	}

	/** The block's text. */
	toString(): string {
		return this.lines.join('\n')
	}

	#push(line: string): void {
		this.lines.push(line)
		this.#cursor.offset += line.length + 1
	}
}
