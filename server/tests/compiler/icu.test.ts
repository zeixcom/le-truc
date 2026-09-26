/**
 * The ICU MessageFormat 1 build half (LT-250, ADR 0030 s4): our parser
 * adapter (`icu/parse.ts`) and our evaluator (`icu/evaluate.ts`), checked
 * differentially against `@messageformat/core` — the oracle, and the only
 * place core is imported. The server fold and LT-218's inlined client copy
 * run this one evaluator, so agreement here is agreement on both sides.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import MessageFormat from '@messageformat/core'
import { formatMessage, type Message } from '../../compiler/icu/evaluate'
import { literalOf, parseMessage } from '../../compiler/icu/parse'
import { corpusPatterns } from './corpus-fixture'

const ROOT = path.resolve(import.meta.dir, '../../..')

// Core formats MF1's named date/time styles with `toLocaleDateString(lc, o)`
// and no `timeZone`, i.e. in the process's zone; ours applies the record's
// `timeZone` (ADR 0030 s2). Pin the process to UTC for the comparison and
// restore it afterward — `bun test` shares one process across files.
const previousTZ = process.env.TZ
beforeAll(() => {
	process.env.TZ = 'UTC'
})
afterAll(() => {
	if (previousTZ === undefined) delete process.env.TZ
	else process.env.TZ = previousTZ
})

const ENV = { timeZone: 'UTC', currency: 'USD' }

const parsed = (pattern: string): Message => {
	const result = parseMessage(pattern)
	if (!result.ok) throw new Error(`${pattern}: ${result.error}`)
	return result.message
}

const ours = (lang: string, pattern: string, args: Record<string, unknown>) =>
	formatMessage(parsed(pattern), args, { lang, ...ENV })

const oracle = (
	lang: string,
	pattern: string,
	args: Record<string, unknown>,
): string =>
	String(
		new MessageFormat(lang, {
			currency: ENV.currency,
			timeZone: ENV.timeZone,
		}).compile(pattern)(
			// Core's argument-less compile ignores its input; ours does too.
			args as Record<string, never>,
		),
	)

/* === The corpus patterns === */

describe('the corpus patterns, against the oracle', async () => {
	const patterns = await corpusPatterns()

	test('the corpus has patterns to compare', () => {
		expect(patterns.length).toBeGreaterThan(20)
	})

	test.each(patterns)('%s: %s', (locale, pattern) => {
		expect(ours(locale, pattern, {})).toBe(oracle(locale, pattern, {}))
	})
})

/* === The supported surface, against the oracle === */

const COUNTS = [0, 1, 2, 3, 5, 11, 22, 101, 1.5]

/** [locale, pattern, argument records] — each record compared separately. */
const POSITIVES: [string, string, Record<string, unknown>[]][] = [
	['en', 'Plain text, no arguments.', [{}]],
	['en', "It''s '{'quoted'}' and '#' stays", [{}]],
	// The parser's leniency, which core shares: an unmatched `}` and an empty
	// `{}` are literal text, not syntax errors.
	['en', 'unopened} and {}', [{}]],
	['en', 'Hello, {name}!', [{ name: 'Ada' }, { name: 42 }]],
	[
		'en',
		'{count, plural, =0 {no tasks} one {# task} other {# tasks}} remaining',
		COUNTS.map(count => ({ count })),
	],
	[
		'cy',
		'{n, plural, zero {# tasgau} one {# dasg} two {# dasg} few {# tasg} many {# thasg} other {# tasg}}',
		COUNTS.map(n => ({ n })),
	],
	[
		'ar',
		'{n, plural, zero {لا مهام} one {مهمة واحدة} two {مهمتان} few {# مهام} many {# مهمة} other {# مهمة}}',
		COUNTS.map(n => ({ n })),
	],
	[
		'de',
		'{n, plural, one {# Aufgabe} other {# Aufgaben}}',
		COUNTS.map(n => ({ n })),
	],
	[
		'en',
		'{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
		COUNTS.map(n => ({ n })),
	],
	[
		'en',
		'{guests, plural, offset:1 =0 {nobody} =1 {{host}} one {{host} and # other} other {{host} and # others}}',
		[0, 1, 2, 3, 10].map(guests => ({ guests, host: 'Ann' })),
	],
	[
		'en',
		'{gender, select, female {She} male {He} other {They}} left {n, plural, one {a note} other {# notes}}.',
		[
			{ gender: 'female', n: 1 },
			{ gender: 'male', n: 4 },
			{ gender: 'x', n: 0 },
			{ gender: 'constructor', n: 2 },
		],
	],
	[
		'en',
		'{kind, select, list {{n, plural, one {# item} other {# items: #}}} other {none}}',
		[
			{ kind: 'list', n: 1 },
			{ kind: 'list', n: 3 },
			{ kind: 'other', n: 3 },
		],
	],
	['de', '{n, number}', [{ n: 1234.5 }, { n: -0.25 }]],
	['en', '{n, number, integer}', [{ n: 1234.56 }]],
	['fr', '{n, number, percent}', [{ n: 0.256 }]],
	['en', '{n, number, currency}', [{ n: 5.5 }]],
	['de', '{n, number, currency:EUR}', [{ n: 1234.5 }]],
	['en', '{n, number, ::percent}', [{ n: 25 }]],
	['en', '{n, number, ::compact-short}', [{ n: 12345 }]],
	['en', '{n, number, ::.00}', [{ n: 3.14159 }]],
	['en', '{n, number, ::scale/100}', [{ n: 0.5 }]],
	['en', '{n, number, ::currency/GBP}', [{ n: 7 }]],
	[
		'en',
		'{n, number, ::measure-unit/length-kilometer unit-width-full-name}',
		[{ n: 50 }],
	],
	[
		'en',
		'{d, date} · {d, date, short} · {d, date, medium} · {d, date, long} · {d, date, full}',
		[{ d: Date.UTC(2024, 0, 5) }, { d: new Date(Date.UTC(1999, 11, 31)) }],
	],
	[
		'de',
		'{d, time} · {d, time, short} · {d, time, long}',
		[{ d: Date.UTC(2024, 0, 5, 14, 3, 9) }],
	],
	['en', '{d, date, ::yMMMd}', [{ d: Date.UTC(2024, 6, 14) }]],
	['ja', '{d, date, ::yMMMMEEEEd}', [{ d: Date.UTC(2024, 6, 14) }]],
]

describe('the supported MF1 surface, against the oracle', () => {
	const rows = POSITIVES.flatMap(([locale, pattern, records]) =>
		records.map(args => [locale, pattern, JSON.stringify(args), args] as const),
	)
	test.each(rows)('%s: %s with %s', (locale, pattern, _, args) => {
		expect(ours(locale, pattern, args)).toBe(oracle(locale, pattern, args))
	})
})

/* === Negatives === */

/** Malformed MF1: both sides must refuse it. */
const SYNTAX_ERRORS = [
	'{unclosed',
	'{n, plural, one {x}}', // no `other`
	'{g, select, a {x}}', // no `other`
	'{n, plural, one {x} other {y}',
	'{n, plural, uno {x} other {y}}', // not a CLDR category
	'{n, number, integer',
]

/** Valid MF1 our evaluator cannot run with `Intl` alone — a reasoned refusal, never a different rendering. */
const UNSUPPORTED = [
	'{n, spellout}',
	'{n, duration}',
	'{n, ordinal}',
	'{n, number, #,##0.00}', // an ICU number PATTERN, not a skeleton
	'{n, number, ::precision-increment/0.5}',
	'{d, date, yyyy-MM-dd}', // a date pattern, not a skeleton
	'{n, plural, other {#}} {n, date}', // one argument, two types
]

describe('negatives', () => {
	test.each(SYNTAX_ERRORS)('malformed %p: refused by both', pattern => {
		const result = parseMessage(pattern)
		expect(result.ok).toBe(false)
		expect(() => oracle('en', pattern, {})).toThrow()
	})

	test.each(UNSUPPORTED)('unsupported %p: refused with a reason', pattern => {
		const result = parseMessage(pattern)
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.error.length).toBeGreaterThan(0)
	})
})

/* === What LT-308 reads: the argument signature === */

describe('argument signatures', () => {
	test('an argument-less pattern has none, and is its literal text', () => {
		const result = parseMessage("It''s '{'done'}'")
		if (!result.ok) throw new Error(result.error)
		expect(result.args).toEqual([])
		expect(literalOf(result.message)).toBe("It's {done}")
	})

	test('each argument has its kind, from how the pattern uses it', () => {
		const result = parseMessage(
			'{who} · {g, select, a {x} other {y}} · {n, plural, other {# {n}}} · {r, selectordinal, other {#}} · {p, number, percent} · {d, date} · {h, time, short}',
		)
		if (!result.ok) throw new Error(result.error)
		expect(result.args).toEqual([
			{ name: 'who', kind: 'plain' },
			{ name: 'g', kind: 'string' },
			{ name: 'n', kind: 'number' },
			{ name: 'r', kind: 'number' },
			{ name: 'p', kind: 'number' },
			{ name: 'd', kind: 'date' },
			{ name: 'h', kind: 'date' },
		])
		expect(literalOf(result.message)).toBeNull()
	})

	test('the narrowest use of an argument wins (LT-344)', () => {
		const result = parseMessage(
			'{a} {a, select, x {X} other {O}} · {b} {b, number} · {c, select, x {X} other {O}} {c}',
		)
		if (!result.ok) throw new Error(result.error)
		expect(result.args).toEqual([
			{ name: 'a', kind: 'string' },
			{ name: 'b', kind: 'number' },
			{ name: 'c', kind: 'string' },
		])
	})

	test('the AST is JSON — it survives a round trip unchanged (LT-218 serializes it)', () => {
		const message = parsed(
			'{n, plural, offset:1 =0 {none} other {# more}} {n, number, ::percent} {d, date, ::yMMMd}',
		)
		expect(JSON.parse(JSON.stringify(message))).toEqual(message)
	})
})

/* === The dependency boundary (ADR 0030 s8) === */

describe('dependency boundary', () => {
	const compilerFiles = (dir: string): string[] =>
		readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
			entry.isDirectory()
				? compilerFiles(path.join(dir, entry.name))
				: entry.name.endsWith('.ts')
					? [path.join(dir, entry.name)]
					: [],
		)

	test('@messageformat/core is a test oracle only — no server/compiler/ file imports it', () => {
		const offenders = compilerFiles(path.join(ROOT, 'server/compiler')).filter(
			file => /['"]@messageformat\/core['"]/.test(readFileSync(file, 'utf8')),
		)
		expect(offenders).toEqual([])
	})

	test('the evaluator imports nothing, so LT-218 can inline it', () => {
		const source = readFileSync(
			path.join(ROOT, 'server/compiler/icu/evaluate.ts'),
			'utf8',
		)
		expect(source).not.toMatch(/^\s*import\b/m)
		expect(source).not.toMatch(/\brequire\(/)
	})
})
