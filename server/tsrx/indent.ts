/**
 * Template-literal-safe line classification for verbatim-slice reindentation
 * (LT-010).
 *
 * `reindent` (emit-server) and `pushStatement` (emit-client) strip the
 * source's common leading indentation from continuation lines of verbatim
 * slices. Inside a multi-line template literal that leading whitespace is
 * STRING CONTENT — stripping it silently changes the rendered value (a
 * validity message carrying `Min length is ${n}\nPlease enter…` loses the
 * second line's indentation). The emitters consult `lineStartsInTemplate` and
 * leave interior lines byte-identical, including their indentation.
 *
 * The scanner is a conservative single-pass lexer over the slice: strings,
 * template literals with `${ … }` interpolation (nested templates included),
 * line and block comments, and escapes. Regex literals are not lexed — a
 * backtick inside a regex would confuse it; none appears in the sanctioned
 * client-code shapes, and the failure mode is over-conservative passthrough,
 * never corruption.
 */

/* === Internal Functions ===

Mode meaning:
- code         — JS/TS source; backtick opens a template, quotes open strings
- lineComment  — `// …` to end of line
- blockComment — block comment (can span lines; never inside a template,
                 where it would be content)
- single/double — quoted strings
- template     — inside the innermost template literal; `${` pushes to code
                 with a fresh interpolation brace depth, its matching `}`
                 pops back

`templateDepth` counts open template literals — interpolation code of an
outer template is still "inside" it for line-mask purposes.
*/
type Mode =
	| 'code'
	| 'lineComment'
	| 'blockComment'
	| 'single'
	| 'double'
	| 'template'

/* === Exported Functions === */

/**
 * For each line of a verbatim slice: does the line BEGIN inside an open
 * template literal? Such lines (including the line that eventually closes the
 * literal — everything before its closing backtick is content) must pass
 * through reindentation untouched.
 */
export const lineStartsInTemplate = (lines: string[]): boolean[] => {
	const mask: boolean[] = new Array(lines.length).fill(false)
	let mode: Mode = 'code'
	// Brace depth inside each open `${ … }`, innermost last. Non-empty means
	// we are inside template interpolation(s).
	const interpDepths: number[] = []
	let templateDepth = 0
	let escaped = false

	for (let i = 0; i < lines.length; i++) {
		mask[i] = templateDepth > 0
		const line = lines[i] as string
		for (let j = 0; j < line.length; j++) {
			const ch = line[j] as string
			const next = j + 1 < line.length ? (line[j + 1] as string) : ''

			if (escaped) {
				escaped = false
				continue
			}

			switch (mode) {
				case 'lineComment':
					j = line.length
					continue
				case 'blockComment':
					if (ch === '*' && next === '/') {
						mode = 'code'
						j++
					}
					continue
				case 'single':
				case 'double':
					if (ch === '\\') escaped = true
					else if (
						(mode === 'single' && ch === "'") ||
						(mode === 'double' && ch === '"')
					)
						mode = 'code'
					continue
				case 'template':
					if (ch === '\\') escaped = true
					else if (ch === '`') {
						templateDepth--
						mode = 'code'
					} else if (ch === '$' && next === '{') {
						interpDepths.push(0)
						mode = 'code'
						j++
					}
					continue
				case 'code':
					if (ch === '/' && next === '/') {
						mode = 'lineComment'
						j = line.length
					} else if (ch === '/' && next === '*') {
						mode = 'blockComment'
						j++
					} else if (ch === "'") mode = 'single'
					else if (ch === '"') mode = 'double'
					else if (ch === '`') {
						templateDepth++
						mode = 'template'
					} else if (ch === '{' && interpDepths.length > 0) {
						const depth = interpDepths.pop() as number
						interpDepths.push(depth + 1)
					} else if (ch === '}' && interpDepths.length > 0) {
						const depth = interpDepths.pop() as number
						if (depth === 0) {
							// Closes the innermost `${ … }` — back into its literal.
							mode = 'template'
						} else interpDepths.push(depth - 1)
					}
					continue
			}
		}

		// A line comment never survives the newline; strings and templates do.
		if (mode === 'lineComment') mode = 'code'
	}

	return mask
}
