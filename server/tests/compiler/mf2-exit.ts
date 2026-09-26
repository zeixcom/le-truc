/**
 * The MF2 exit (LT-253, ADR 0030 Alternatives): the mechanical MF1 → MF2
 * conversion the migration would run, as a test-side helper. The two
 * upstream packages do the work — `@messageformat/icu-messageformat-1`
 * lifts MF1 into the MF2 data model, `messageformat@4` serializes, parses
 * and renders it. Our only additions are two normalizations the
 * converter's output needs before it is valid, serializable MF2:
 * {@link dedupeInputs} and {@link stringifyLiterals}.
 *
 * Like `@messageformat/core`, both packages are test dependencies only —
 * no `server/compiler/` file imports them (pinned in mf2-exit.test.ts).
 * The rebaseline procedure the migration follows is in MF2_EXIT.md, beside
 * this file.
 */
import {
	MF1Functions,
	mf1ToMessageData,
} from '@messageformat/icu-messageformat-1'
import { parse, type Token } from '@messageformat/parser'
import {
	MessageFormat,
	type Model,
	parseMessage as parseMF2,
	stringifyMessage,
} from 'messageformat'

/**
 * MF1 lets one argument drive selectors of different types in different
 * arms — `{type, select, ordinal {{count, selectordinal, …}} other
 * {{count, plural, …}}}`, basic-pluralize's `tasks` since LT-252. The
 * converter lifts each into its own `.input {$count …}`, and MF2 forbids
 * declaring a variable twice (`duplicate-declaration`). Rewrite every
 * input of a repeated variable as a `.local $count__N = {$count …}` over
 * the external variable, and point its selector at the local.
 *
 * Placeholders (`#` becomes `{$count}`) keep reading the external
 * variable — the same number, formatted without an annotation, which
 * renders as `:number` does. That equivalence breaks under a plural
 * `offset` (`#` is the offset value), so a repeated variable with an
 * offset is refused: the exit cannot carry it mechanically, and the test
 * suite says so at authoring time.
 */
export const dedupeInputs = (message: Model.Message): Model.Message => {
	if (message.type !== 'select') return message
	const inputs = new Map<string, number>()
	for (const decl of message.declarations)
		if (decl.type === 'input')
			inputs.set(decl.name, (inputs.get(decl.name) ?? 0) + 1)
	if (![...inputs.values()].some(n => n > 1)) return message

	// The converter emits one input per selector, in selector order.
	const { declarations, selectors } = message
	if (
		declarations.length !== selectors.length ||
		declarations.some(
			(decl, i) => decl.type !== 'input' || decl.name !== selectors[i]?.name,
		)
	)
		throw new Error('MF2 exit: unexpected converter output shape')

	const seen = new Map<string, number>()
	const renamed: string[] = []
	const next = declarations.map((decl): Model.Declaration => {
		if ((inputs.get(decl.name) ?? 0) < 2) {
			renamed.push(decl.name)
			return decl
		}
		if (decl.value.functionRef?.options?.offset)
			throw new Error(
				`MF2 exit: $${decl.name} drives more than one selector and one has a plural offset — not mechanically convertible`,
			)
		const n = seen.get(decl.name) ?? 0
		seen.set(decl.name, n + 1)
		const name = `${decl.name}__${n}`
		renamed.push(name)
		return { type: 'local', name, value: decl.value }
	})
	return {
		...message,
		declarations: next,
		selectors: renamed.map(name => ({ type: 'variable', name })),
	}
}

/**
 * The converter maps number skeletons to `Intl.NumberFormat` options and
 * copies their values into MF2 literals as-is — `::.00` yields
 * `minimumFractionDigits: 2`, a number. The formatter accepts that, but
 * `stringifyMessage` requires string literals and throws, so the text the
 * migration commits could not be written. Stringify every literal option
 * value; MF2's functions parse digit-string options, so rendering is
 * unchanged.
 */
export const stringifyLiterals = (message: Model.Message): Model.Message => {
	const options = (opts: Model.Options | undefined) =>
		opts &&
		Object.fromEntries(
			Object.entries(opts).map(([key, value]) => [
				key,
				value.type === 'literal' && typeof value.value !== 'string'
					? { ...value, value: String(value.value) }
					: value,
			]),
		)
	const expression = <T extends Model.Expression>(expr: T): T =>
		expr.functionRef
			? {
					...expr,
					functionRef: {
						...expr.functionRef,
						options: options(expr.functionRef.options),
					},
				}
			: expr
	const pattern = (parts: Model.Pattern): Model.Pattern =>
		parts.map(part =>
			typeof part !== 'string' && part.type === 'expression'
				? expression(part)
				: part,
		)
	const declarations = message.declarations.map(
		(decl): Model.Declaration =>
			decl.type === 'input'
				? { ...decl, value: expression(decl.value) }
				: { ...decl, value: expression(decl.value) },
	)
	return message.type === 'select'
		? {
				...message,
				declarations,
				variants: message.variants.map(variant => ({
					...variant,
					value: pattern(variant.value),
				})),
			}
		: { ...message, declarations, pattern: pattern(message.pattern) }
}

/** MF1 source → MF2 data model, normalized. */
export const toMF2Data = (mf1: string): Model.Message =>
	stringifyLiterals(dedupeInputs(mf1ToMessageData(parse(mf1))))

/** MF1 source → MF2 source text: what the migration commits. */
export const toMF2 = (mf1: string): string => stringifyMessage(toMF2Data(mf1))

/**
 * Compile MF2 source text. Bidi isolation is off: MF2 wraps every
 * placeholder in FSI/PDI by default and MF1 never did, so leaving it on
 * would change every rendered string (MF2_EXIT.md, "Rendering").
 */
export const compileMF2 = (lang: string, mf2: string) =>
	new MessageFormat(lang, parseMF2(mf2), {
		functions: MF1Functions,
		bidiIsolation: 'none',
	})

/** The MF1 parser's AST, for walking select keys. */
export const mf1Tokens = (mf1: string): Token[] => parse(mf1)
