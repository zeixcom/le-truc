/**
 * ICU MessageFormat 1 at build time (ADR 0030 s4, LT-250): parse a message
 * pattern into the evaluator's AST, and read off the argument signature.
 *
 * Parse, don't compile. `@messageformat/parser` does the grammar; the
 * skeleton packages resolve `::` skeletons to plain `Intl` options HERE, so
 * nothing skeleton-shaped survives into the AST and the evaluator
 * (`evaluate.ts`) stays a dependency-free walk. `@messageformat/core` is
 * never imported from `server/compiler/` production paths — it is the
 * differential test oracle only (pinned by `icu.test.ts`).
 *
 * The supported surface is what `evaluate.ts` can run with `Intl` alone:
 * `{x}`, `{n, number}` (bare, `integer`, `percent`, `currency`,
 * `currency:XYZ`, `::skeleton`), `{d, date|time}` (bare, `short`, `medium`,
 * `long`, `full`, `::skeleton`), `plural`/`selectordinal` (with `offset:`
 * and `=N` cases) and `select`. Anything else — a custom formatter
 * (`spellout`, `duration`), an ICU number PATTERN (`#,##0.00`), a
 * `precision-increment` skeleton — is a parse failure with a reason, never a
 * silently different rendering.
 */

import { getDateFormatOptions } from '@messageformat/date-skeleton/lib/options.js'
import { parseDateTokens } from '@messageformat/date-skeleton/lib/tokens.js'
import { getNumberFormatOptions } from '@messageformat/number-skeleton/lib/numberformat/options.js'
import { parseNumberSkeleton } from '@messageformat/number-skeleton/lib/parse-skeleton.js'
import {
	type Content,
	type FunctionArg,
	type Octothorpe,
	type PlainArg,
	parse,
	type Select,
} from '@messageformat/parser'
import type { Message, MessageNode } from './evaluate'

/* === Types === */

/**
 * The value type an argument takes, from how the pattern uses it (LT-308
 * types each key from this): `plural`/`selectordinal`/`number` → number,
 * `date`/`time` → date, a `select` selector → string (its cases are keyed
 * by string), and a plain `{x}` → `plain`, a string or a number (LT-344):
 * the evaluator renders it with `String(value)`. A date is not plain —
 * `String(date)` is the engine's locale-free `toString`; it belongs in
 * `{d, date}`. When one argument is used several ways, the narrowest use
 * wins: number/date over string over plain.
 */
export type MessageArgKind = 'number' | 'date' | 'string' | 'plain'

/** One argument a message takes. */
export type MessageArg = { name: string; kind: MessageArgKind }

/**
 * A parsed pattern. `args` is empty for an argument-less message, whose
 * `t.<key>` is a plain string; otherwise `t.<key>` is a function of an
 * argument record with exactly these names.
 */
export type ParsedMessage =
	| { ok: true; message: Message; args: readonly MessageArg[] }
	| { ok: false; error: string }

type Token = Content | PlainArg | FunctionArg | Select | Octothorpe

/* === Internal Functions === */

class UnsupportedPattern extends Error {}

/** `Intl.DateTimeFormat` options for MF1's named date/time styles — `@messageformat/runtime`'s table. */
const dateStyleOptions = (
	key: 'date' | 'time',
	style: string,
): Intl.DateTimeFormatOptions => {
	if (key === 'date') {
		const o: Intl.DateTimeFormatOptions = {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		}
		if (style === 'full') o.weekday = 'long'
		if (style === 'full' || style === 'long') o.month = 'long'
		else if (style === 'short') o.month = 'numeric'
		return o
	}
	const o: Intl.DateTimeFormatOptions = {
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
	}
	if (style === 'full' || style === 'long') o.timeZoneName = 'short'
	else if (style === 'short') delete o.second
	return o
}

const NAMED_DATE_STYLES = new Set(['', 'short', 'medium', 'long', 'full'])

/** The literal text of a function argument's style, or throw. */
const styleText = (token: FunctionArg): string => {
	const param = token.param ?? []
	if (param.length === 0) return ''
	const [only] = param
	if (param.length > 1 || only?.type !== 'content')
		throw new UnsupportedPattern(
			`the \`${token.key}\` style of \`{${token.arg}}\` must be literal text`,
		)
	return only.value.trim()
}

const numberNode = (token: FunctionArg): MessageNode => {
	const style = styleText(token)
	const a = token.arg
	switch (style) {
		case '':
			return { t: 'num', a }
		case 'integer':
			return { t: 'num', a, o: { maximumFractionDigits: 0 } }
		case 'percent':
			return { t: 'num', a, o: { style: 'percent' } }
	}
	const currency = /^currency(?::\s*([A-Z]{3}))?$/.exec(style)
	if (currency)
		return {
			t: 'num',
			a,
			o: {
				style: 'currency',
				...(currency[1] ? { currency: currency[1] } : {}),
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			},
		}
	if (!style.startsWith('::'))
		throw new UnsupportedPattern(
			`\`{${a}, number, ${style}}\` — use \`integer\`, \`percent\`, \`currency\`, or a \`::\` skeleton`,
		)
	const problems: string[] = []
	const skeleton = parseNumberSkeleton(style.slice(2), err =>
		problems.push(err.message),
	)
	if (skeleton.precision?.style === 'precision-increment')
		problems.push('`precision-increment` has no `Intl` equivalent')
	const o = getNumberFormatOptions(skeleton, err => problems.push(err.message))
	if (problems.length > 0)
		throw new UnsupportedPattern(
			`\`{${a}, number, ${style}}\`: ${problems.join('; ')}`,
		)
	if (skeleton.numberingSystem) o.numberingSystem = skeleton.numberingSystem
	let s =
		typeof skeleton.scale === 'number' && skeleton.scale >= 0
			? skeleton.scale
			: 1
	if (skeleton.unit?.style === 'percent') s *= 0.01
	return s === 1 ? { t: 'num', a, o } : { t: 'num', a, o, s }
}

const dateNode = (token: FunctionArg, key: 'date' | 'time'): MessageNode => {
	const style = styleText(token)
	const a = token.arg
	if (NAMED_DATE_STYLES.has(style))
		return { t: 'date', a, o: dateStyleOptions(key, style) }
	if (!style.startsWith('::'))
		throw new UnsupportedPattern(
			`\`{${a}, ${key}, ${style}}\` — use \`short\`, \`medium\`, \`long\`, \`full\`, or a \`::\` skeleton`,
		)
	const problems: string[] = []
	const o = getDateFormatOptions(
		parseDateTokens(style.slice(2)),
		undefined,
		err => {
			if (err.type === 'error') problems.push(err.message)
		},
	)
	if (problems.length > 0)
		throw new UnsupportedPattern(
			`\`{${a}, ${key}, ${style}}\`: ${problems.join('; ')}`,
		)
	return { t: 'date', a, o }
}

/** How narrow each kind is: a narrower use of the same argument wins. */
const KIND_RANK: Record<MessageArgKind, number> = {
	plain: 0,
	string: 1,
	number: 2,
	date: 2,
}

/** Record `name` used as `kind`; a number/date clash cannot be typed. */
const noteArg = (
	args: Map<string, MessageArgKind>,
	name: string,
	kind: MessageArgKind,
): void => {
	const prior = args.get(name)
	if (prior === undefined || KIND_RANK[kind] > KIND_RANK[prior]) {
		args.set(name, kind)
		return
	}
	if (KIND_RANK[kind] === 2 && kind !== prior)
		throw new UnsupportedPattern(
			`\`{${name}}\` is used both as a ${prior} and as a ${kind}`,
		)
}

const convert = (
	tokens: readonly Token[],
	plural: Select | null,
	args: Map<string, MessageArgKind>,
): Message => {
	const out: Message = []
	for (const token of tokens) {
		let node: MessageNode
		switch (token.type) {
			case 'content':
				node = token.value
				break
			case 'octothorpe':
				// The parser only emits `#` as a token inside a plural (a bare
				// one outside is content), but guard: no enclosing plural, no
				// number to print — it is the literal character.
				node = plural
					? plural.pluralOffset
						? { t: '#', a: plural.arg, off: plural.pluralOffset }
						: { t: '#', a: plural.arg }
					: '#'
				break
			case 'argument':
				noteArg(args, token.arg, 'plain')
				node = { t: 'arg', a: token.arg }
				break
			case 'function':
				if (token.key === 'number') {
					noteArg(args, token.arg, 'number')
					node = numberNode(token)
				} else if (token.key === 'date' || token.key === 'time') {
					noteArg(args, token.arg, 'date')
					node = dateNode(token, token.key)
				} else
					throw new UnsupportedPattern(
						`\`{${token.arg}, ${token.key}}\` — \`${token.key}\` is not a supported formatter (number, date, time, plural, selectordinal, select)`,
					)
				break
			case 'select':
			case 'plural':
			case 'selectordinal': {
				const isPlural = token.type !== 'select'
				noteArg(args, token.arg, isPlural ? 'number' : 'string')
				const c: Record<string, Message> = {}
				for (const arm of token.cases)
					c[arm.key] = convert(arm.tokens, isPlural ? token : plural, args)
				if (!Object.hasOwn(c, 'other'))
					throw new UnsupportedPattern(
						`\`{${token.arg}, ${token.type}}\` has no \`other\` case`,
					)
				if (!isPlural) node = { t: 'select', a: token.arg, c }
				else {
					const pl: MessageNode = { t: 'plural', a: token.arg, c }
					if (token.type === 'selectordinal') pl.o = 1
					if (token.pluralOffset) pl.off = token.pluralOffset
					node = pl
				}
				break
			}
		}
		// Adjacent text merges: `'{'` escapes split content tokens.
		const last = out.at(-1)
		if (typeof node === 'string' && typeof last === 'string')
			out[out.length - 1] = last + node
		else out.push(node)
	}
	return out
}

/* === Exported Functions === */

/**
 * Parse an MF1 pattern. Never throws: a syntax error or an unsupported
 * construct comes back as `{ ok: false, error }` — the compiler turns that
 * into a diagnostic for a source pattern, and a translation that fails to
 * parse falls back to the source (ADR 0030 s5: a translator's typo must not
 * make a locale unbuildable).
 */
export const parseMessage = (pattern: string): ParsedMessage => {
	const args = new Map<string, MessageArgKind>()
	try {
		const message = convert(parse(pattern), null, args)
		return {
			ok: true,
			message,
			args: [...args].map(([name, kind]) => ({ name, kind })),
		}
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * The argument-less form of a parsed message: its literal text, or null
 * when the message takes arguments. An argument-less `t.<key>` is this
 * string — MF1 escapes already resolved (`'{'` → `{`, `''` → `'`).
 */
export const literalOf = (message: Message): string | null => {
	if (message.length === 0) return ''
	const [only] = message
	return message.length === 1 && typeof only === 'string' ? only : null
}
