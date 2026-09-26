/**
 * MF2 migration insurance (LT-253, ADR 0030 Alternatives). MF1 is a bet
 * with a kept-open exit; this suite turns "the migration is mechanical"
 * into a gate. Every corpus pattern goes MF1 → MF2 source text → back
 * through the MF2 parser, and both sides render a matrix of arguments in
 * every locale that can render the pattern: our evaluator (what ships)
 * for MF1, `messageformat@4` for MF2. They must agree byte for byte.
 *
 * An MF1 pattern the exit cannot carry therefore fails here, at authoring
 * time. The known-lossy spots are pinned below; the rebaseline procedure
 * is in MF2_EXIT.md.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import { mf1ToMessageData } from '@messageformat/icu-messageformat-1'
import {
	MessageFormat,
	parseMessage as parseMF2,
	stringifyMessage,
} from 'messageformat'
import { formatMessage } from '../../compiler/icu/evaluate'
import { type MessageArg, parseMessage } from '../../compiler/icu/parse'
import { corpusPatterns } from './corpus-fixture'
import { compileMF2, mf1Tokens, toMF2, toMF2Data } from './mf2-exit'

const ROOT = path.resolve(import.meta.dir, '../../..')

/** The catalog locales; an `en` source pattern renders in each as the fallback. */
const LOCALES = readdirSync(path.join(ROOT, 'i18n'))
	.filter(file => file.endsWith('.json') && file !== 'manifest.json')
	.map(file => file.replace(/\.json$/, ''))
	.sort()

/* === Rendering both sides === */

const ENV = { timeZone: 'UTC', currency: 'USD' }

// MF2's date functions format in the process's zone; ours applies the
// record's `timeZone`. Pin the process to UTC, as icu.test.ts does.
const previousTZ = process.env.TZ
beforeAll(() => {
	process.env.TZ = 'UTC'
})
afterAll(() => {
	if (previousTZ === undefined) delete process.env.TZ
	else process.env.TZ = previousTZ
})

const renderMF1 = (
	lang: string,
	pattern: string,
	args: Record<string, unknown>,
) => {
	const result = parseMessage(pattern)
	if (!result.ok) throw new Error(`${pattern}: ${result.error}`)
	return formatMessage(result.message, args, { lang, ...ENV })
}

/**
 * MF2's formatter recovers from a bad function or option with a fallback
 * rendering and a warning. The exit counts a warning as a failure: collect
 * them and throw.
 */
const renderMF2 = (
	lang: string,
	mf2: string,
	args: Record<string, unknown>,
) => {
	const errors: unknown[] = []
	const out = compileMF2(lang, mf2).format(args, error => errors.push(error))
	if (errors.length)
		throw new Error(`MF2 ${mf2}: ${errors.map(String).join('; ')}`)
	return out
}

/* === The argument matrix === */

/**
 * Counts covering every CLDR category in the six locales: ar few (3–10)
 * and many (11–99), cy's 0/1/2/3/6, lv zero (0, 10–20), pl few/many, the
 * ordinal arms, and a fraction.
 */
const COUNTS = [0, 1, 2, 3, 4, 5, 6, 10, 11, 12, 21, 22, 23, 101, 1.5]

/** Select keys per argument, walked from the MF1 AST. */
const selectKeys = (pattern: string): Map<string, Set<string>> => {
	const keys = new Map<string, Set<string>>()
	const walk = (tokens: ReturnType<typeof mf1Tokens>) => {
		for (const token of tokens) {
			if (
				token.type !== 'select' &&
				token.type !== 'plural' &&
				token.type !== 'selectordinal'
			)
				continue
			if (token.type === 'select') {
				const set = keys.get(token.arg) ?? new Set()
				for (const c of token.cases) set.add(c.key)
				keys.set(token.arg, set)
			}
			for (const c of token.cases) walk(c.tokens)
		}
	}
	walk(mf1Tokens(pattern))
	return keys
}

const valuesFor = (arg: MessageArg, keys: Map<string, Set<string>>) => {
	switch (arg.kind) {
		case 'number':
			return COUNTS
		case 'string':
			// Every spelled key, an unspelled one, and a prototype name.
			return [...(keys.get(arg.name) ?? []), 'unspelled', 'constructor']
		case 'date':
			return [Date.UTC(2024, 0, 5, 14, 3, 9)]
		case 'plain':
			// Plain placeholders carry strings in the corpus (form-tokenbox's
			// `token`); a number in one is a pinned divergence, below.
			return ['Ada', 'a{b}|c\\d']
	}
}

/** Every combination of every argument's values. */
const matrix = (pattern: string): Record<string, unknown>[] => {
	const result = parseMessage(pattern)
	if (!result.ok) throw new Error(`${pattern}: ${result.error}`)
	const keys = selectKeys(pattern)
	let rows: Record<string, unknown>[] = [{}]
	for (const arg of result.args)
		rows = rows.flatMap(row =>
			valuesFor(arg, keys).map(value => ({ ...row, [arg.name]: value })),
		)
	return rows
}

/** Assert MF1 and its MF2 conversion agree on every row, in `lang`. */
const expectRoundTrip = (lang: string, pattern: string) => {
	const mf2 = toMF2(pattern)
	for (const args of matrix(pattern))
		expect({ args, out: renderMF2(lang, mf2, args) }).toEqual({
			args,
			out: renderMF1(lang, pattern, args),
		})
}

/* === The corpus gate === */

describe('every corpus pattern survives MF1 → MF2', async () => {
	const patterns = await corpusPatterns()
	// An `en` source pattern also renders in every catalog locale that has
	// no translation for its key, under that locale's plural rules.
	const rows = patterns.flatMap(([locale, pattern]) =>
		locale === 'en'
			? ['en', ...LOCALES].map(lang => [lang, pattern] as const)
			: [[locale, pattern] as const],
	)

	test('the corpus has patterns to carry, in all six locales', () => {
		expect(patterns.length).toBeGreaterThan(20)
		expect(LOCALES).toEqual(['ar', 'cy', 'de', 'lv', 'pl', 'zh'])
		for (const locale of LOCALES)
			expect(patterns.some(([l]) => l === locale)).toBe(true)
	})

	test('the corpus exercises a selector, not only plain strings', () => {
		expect(
			patterns.some(([, p]) => /,\s*(plural|selectordinal|select)\s*,/.test(p)),
		).toBe(true)
	})

	test.each(rows)('%s: %s', (lang, pattern) => {
		const mf2 = toMF2(pattern)
		// The committed MF2 text is a fixed point of its own parser.
		expect(stringifyMessage(parseMF2(mf2))).toBe(mf2)
		expectRoundTrip(lang, pattern)
	})
})

/* === The known-lossy spots === */

describe('nested-to-flat arm expansion', () => {
	// MF1 nests plural inside select; MF2 has one flat multi-selector, so
	// the arms multiply out. Semantically identical, textually larger.
	const NESTED =
		'{g, select, female {{n, plural, one {She has # task} other {She has # tasks}}} other {{n, plural, one {They have # task} other {They have # tasks}}}}'

	test('a nested select/plural becomes one two-selector match', () => {
		expect(toMF2(NESTED)).toBe(
			[
				'.input {$g :string}',
				'.input {$n :number}',
				'.match $g $n',
				'female one {{She has {$n} task}}',
				'female * {{She has {$n} tasks}}',
				'* one {{They have {$n} task}}',
				'* * {{They have {$n} tasks}}',
			].join('\n'),
		)
		for (const lang of ['en', 'de']) expectRoundTrip(lang, NESTED)
	})

	test('sibling selectors multiply, repeating the text around them', () => {
		const SIBLINGS =
			'{g, select, a {A} other {O}} and {n, plural, one {one} other {many}}.'
		const data = toMF2Data(SIBLINGS)
		if (data.type !== 'select') throw new Error('expected a select message')
		expect(data.variants).toHaveLength(4)
		expect(toMF2(SIBLINGS)).toBe(
			[
				'.input {$g :string}',
				'.input {$n :number}',
				'.match $g $n',
				'a one {{A and one.}}',
				'a * {{A and many.}}',
				'* one {{O and one.}}',
				'* * {{O and many.}}',
			].join('\n'),
		)
		expectRoundTrip('en', SIBLINGS)
	})

	test('arm count is the product of each locale’s spelled key sets', () => {
		// basic-pluralize's cy catalog: six cardinal arms, six ordinal arms,
		// both under `type`.
		const cy = JSON.parse(readFileSync(path.join(ROOT, 'i18n/cy.json'), 'utf8'))
		const pattern: string = cy['basic-pluralize.tasks']
		const data = toMF2Data(pattern)
		if (data.type !== 'select') throw new Error('expected a select message')
		// type {ordinal, *} × ordinal {6} × cardinal {6}
		expect(data.selectors).toHaveLength(3)
		expect(data.variants).toHaveLength(2 * 6 * 6)
		expectRoundTrip('cy', pattern)
	})
})

describe('escaping', () => {
	// MF1 quotes with apostrophes; MF2 has no apostrophe syntax, escapes
	// `{ } \` with a backslash in text, and quotes `|literal|` only in
	// literals (`|` in text stays bare). A codemod that copies text across
	// verbatim goes wrong in both directions.
	test.each([
		["It''s '{'quoted'}' here", "It's \\{quoted\\} here"],
		["'{literal}' braces", '\\{literal\\} braces'],
		['a | b \\ c', 'a | b \\\\ c'],
		["Don't worry", "Don't worry"],
	])('%p → %p', (mf1, mf2) => {
		expect(toMF2(mf1)).toBe(mf2)
		expect(renderMF2('en', mf2, {})).toBe(renderMF1('en', mf1, {}))
	})

	test('a quoted octothorpe stays literal inside a plural arm', () => {
		const pattern = "{n, plural, one {# '#'1} other {# is #'#'}}"
		expect(toMF2(pattern)).toContain('{{{$n} #1}}')
		expectRoundTrip('en', pattern)
	})

	test('a bare `#` outside any plural is literal on both sides', () => {
		expect(toMF2('Item #{id}')).toBe('Item #{$id}')
		expectRoundTrip('en', 'Item #{id}')
	})

	test('a skeleton option lands as a |quoted| MF2 literal', () => {
		expect(toMF2('{n, number, ::.00}')).toBe(
			'{$n :number minimumFractionDigits=2 maximumFractionDigits=2 @mf1:argType=number @mf1:argStyle=|::.00|}',
		)
		expectRoundTrip('en', '{n, number, ::.00}')
	})

	test('a select key MF2 reads as a name needs no quoting', () => {
		expect(toMF2('{k, select, 1st {first} other {o}}')).toContain(
			'1st {{first}}',
		)
		expectRoundTrip('en', '{k, select, 1st {first} other {o}}')
	})

	test('an apostrophe-quoted MF2 sigil is plain text, not a variable', () => {
		const pattern = "costs '{'$price'}'"
		expect(toMF2(pattern)).toBe('costs \\{$price\\}')
		expect(renderMF2('en', toMF2(pattern), { price: 5 })).toBe('costs {$price}')
	})
})

describe('one argument, more than one selector type (basic-pluralize `tasks`)', () => {
	const TASKS =
		'{type, select, ordinal {{count, selectordinal, one {st} other {th}}} other {{count, plural, one {task} other {tasks}}}}'

	test('the converter alone emits invalid MF2 — the normalization is load-bearing', () => {
		// If upstream starts emitting valid MF2 here, this fails: drop
		// `dedupeInputs` and update MF2_EXIT.md.
		const raw = mf1ToMessageData(mf1Tokens(TASKS))
		expect(() => new MessageFormat('en', raw)).toThrow('duplicate-declaration')
	})

	test('normalized: one local per selector over the external variable', () => {
		expect(toMF2(TASKS)).toBe(
			[
				'.input {$type :string}',
				'.local $count__0 = {$count :number select=ordinal}',
				'.local $count__1 = {$count :number}',
				'.match $type $count__0 $count__1',
				// The flat product spells arms no input can reach (an
				// ordinal key beside a cardinal one): harmless, but bytes.
				'ordinal one one {{st}}',
				'ordinal one * {{st}}',
				'ordinal * one {{th}}',
				'ordinal * * {{th}}',
				'* one one {{task}}',
				'* one * {{tasks}}',
				'* * one {{task}}',
				'* * * {{tasks}}',
			].join('\n'),
		)
		for (const lang of ['en', ...LOCALES]) expectRoundTrip(lang, TASKS)
	})

	test('a `#` in a deduplicated selector’s arm still renders the count', () => {
		const pattern =
			'{type, select, ordinal {{count, selectordinal, one {#st} other {#th}}} other {{count, plural, one {# task} other {# tasks}}}}'
		expectRoundTrip('en', pattern)
	})

	test('with a plural offset the exit refuses rather than mistranslate', () => {
		expect(() =>
			toMF2(
				'{k, select, a {{n, plural, offset:1 other {#}}} other {{n, selectordinal, other {#}}}}',
			),
		).toThrow('not mechanically convertible')
	})
})

describe('pinned divergence: a number in a plain placeholder', () => {
	// MF1 `{n}` stringifies; MF2 `{$n}` formats a number by locale. No
	// corpus placeholder carries a number today — if one does, annotate it
	// `{n, number}` in MF1 first, which both sides format alike.
	test('plain `{n}` differs, `{n, number}` agrees', () => {
		expect(renderMF1('de', 'x {n}', { n: 1234.5 })).toBe('x 1234.5')
		expect(renderMF2('de', toMF2('x {n}'), { n: 1234.5 })).toBe('x 1.234,5')
		expectRoundTrip('de', '{n, number}')
	})
})

/* === What the exit does not carry: the supported MF1 surface, mapped === */

describe('the supported MF1 surface through the exit', () => {
	// Constructs our evaluator renders (icu.test.ts's positives) that the
	// exit renders differently or not at all. No corpus pattern uses one
	// today — the corpus gate above would fail if it did. If upstream
	// closes a gap, its row fails here: move it to CARRIED and update
	// MF2_EXIT.md.
	const NOT_CARRIED: [string, string, Record<string, unknown>, string][] = [
		// MF1 `percent` rounds to an integer; `:unit` keeps the fraction.
		['fr', '{n, number, percent}', { n: 0.256 }, 'fraction digits'],
		// So does `::percent`, on a fractional input.
		['en', '{n, number, ::percent}', { n: 1.5 }, 'fraction digits'],
		// A date skeleton renders right, but through a warned fallback.
		['en', '{d, date, ::yMMMd}', { d: Date.UTC(2024, 6, 14) }, 'date skeleton'],
		// The record's default currency has no MF2 channel.
		['en', '{n, number, currency}', { n: 5.5 }, 'env currency'],
		// `currency:EUR` is not a skeleton; the converter drops it.
		['de', '{n, number, currency:EUR}', { n: 1234.5 }, 'legacy currency style'],
		// `notation` is unsupported by the converter.
		['en', '{n, number, ::compact-short}', { n: 12345 }, 'compact notation'],
		// `time, long` loses its zone name.
		[
			'de',
			'{d, time, long}',
			{ d: Date.UTC(2024, 0, 5, 14, 3, 9) },
			'time zone name',
		],
	]

	test.each(NOT_CARRIED)(
		'%s %s: not carried (%p, %s)',
		(lang, pattern, args) => {
			let mf2: string | Error
			try {
				mf2 = renderMF2(lang, toMF2(pattern), args)
			} catch (error) {
				mf2 = error as Error
			}
			expect(mf2).not.toBe(renderMF1(lang, pattern, args))
		},
	)

	const CARRIED: [string, string][] = [
		['en', 'Hello, {name}!'],
		[
			'en',
			'{count, plural, =0 {no tasks} one {# task} other {# tasks}} remaining',
		],
		[
			'cy',
			'{n, plural, zero {# tasgau} one {# dasg} two {# dasg} few {# tasg} many {# thasg} other {# tasg}}',
		],
		[
			'ar',
			'{n, plural, zero {لا مهام} one {مهمة واحدة} two {مهمتان} few {# مهام} many {# مهمة} other {# مهمة}}',
		],
		['en', '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}'],
		[
			'en',
			'{guests, plural, offset:1 =0 {nobody} =1 {{host}} one {{host} and # other} other {{host} and # others}}',
		],
		[
			'en',
			'{kind, select, list {{n, plural, one {# item} other {# items: #}}} other {none}}',
		],
		['de', '{n, number}'],
		['en', '{n, number, integer}'],
		['en', '{n, number, ::scale/100}'],
		['en', '{n, number, ::currency/GBP}'],
		['en', '{n, number, ::measure-unit/length-kilometer unit-width-full-name}'],
		[
			'en',
			'{d, date} · {d, date, short} · {d, date, medium} · {d, date, long} · {d, date, full}',
		],
		['de', '{d, time} · {d, time, short}'],
	]

	test.each(CARRIED)('%s %s: carried', (lang, pattern) => {
		expectRoundTrip(lang, pattern)
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

	test('the MF2 packages are test-only — no server/compiler/ file imports them', () => {
		const offenders = compilerFiles(path.join(ROOT, 'server/compiler')).filter(
			file =>
				/['"](messageformat|@messageformat\/icu-messageformat-1)['"]/.test(
					readFileSync(file, 'utf8'),
				),
		)
		expect(offenders).toEqual([])
	})
})
