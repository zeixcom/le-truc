/**
 * Verbatim tag-scoped CSS extraction (ADR 0023 sub-design 2).
 *
 * `@tsrx/core`'s render pipeline (`renderStylesheets`) class-hashes every
 * rule; Le Truc instead emits the `<style>` block's `stylesheet.source`
 * verbatim. The only transformation is whitespace: the style body is
 * indented to its nesting depth inside the source file, so the common
 * leading indentation is stripped and the result is trimmed to the CSS
 * itself. Rules already scope themselves to the component's tag
 * (`module-tabgroup { … }`), so the emitted artifact drops straight into a
 * page's stylesheet — no hashing, no scoping wrapper, byte-comparable with
 * the hand-written `.css` artifacts of the examples corpus.
 */

/* === Exported Functions === */

/**
 * Normalize a `<style>` block's `stylesheet.source` to standalone CSS:
 * strip the common leading indentation from every non-blank line, drop
 * leading/trailing blank lines, and end with exactly one newline.
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
