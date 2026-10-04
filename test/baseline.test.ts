import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
	BASELINE_ALLOWLIST,
	checkPin,
	compatIndex,
	evaluateBaseline,
	flattenNesting,
	SYNTAX_KEYS,
	scanCss,
	scanTypeScript,
} from '../scripts/lib/baseline'

// LT-305: the baseline guard. The gate itself is `bun run check:baseline`;
// these pin the scanner, the judgement and the pin rule on fixtures.

const root = join(import.meta.dir, '..')
const fixture = (name: string) =>
	join(import.meta.dir, 'fixtures/baseline', name)
const keysOf = (findings: { key: string }[]) =>
	new Set(findings.map(finding => finding.key))

describe('baseline scan: TypeScript', () => {
	test('an unguarded Baseline 2024 API fails a 2023 pin', () => {
		const findings = scanTypeScript([fixture('unguarded-2024.ts')], { root })
		const report = evaluateBaseline(findings, 2023, {})
		expect(report.violations.map(v => v.key)).toEqual([
			'javascript.builtins.Promise.withResolvers',
		])
		expect(report.violations[0]?.at).toContain('unguarded-2024.ts:5:')
		// The same use is within a 2024 pin.
		expect(evaluateBaseline(findings, 2024, {}).violations).toEqual([])
	})

	test('Baseline 2023 features pass, through mixins and statics; types ship nothing', () => {
		const findings = scanTypeScript([fixture('within-2023.ts')], { root })
		const keys = keysOf(findings)
		expect(keys.has('api.HTMLElement.attachInternals')).toBe(true)
		// `ariaLabel` sits on the ARIAMixin interface; BCD files it on Element.
		expect(keys.has('api.Element.ariaLabel')).toBe(true)
		expect(keys.has('javascript.builtins.Object.hasOwn')).toBe(true)
		expect(keys.has('api.CustomStateSet')).toBe(false)
		expect(evaluateBaseline(findings, 2023, {}).violations).toEqual([])
	})

	test('names every syntax form it maps', () => {
		const keys = keysOf(scanTypeScript([fixture('syntax.ts')], { root }))
		for (const key of [
			SYNTAX_KEYS.staticBlock,
			SYNTAX_KEYS.privateIn,
			SYNTAX_KEYS.regexUnicodeSets,
			SYNTAX_KEYS.regexHasIndices,
			SYNTAX_KEYS.regexModifier,
			SYNTAX_KEYS.using,
			SYNTAX_KEYS.topLevelAwait,
		])
			expect(keys).toContain(key)
	})

	test('every mapped syntax key exists in web-features', () => {
		const index = compatIndex()
		for (const key of Object.values(SYNTAX_KEYS))
			expect(index.has(key)).toBe(true)
	})
})

describe('baseline scan: CSS', () => {
	test('names properties, values, selectors, at-rules, functions and units', () => {
		const keys = keysOf(
			scanCss(
				`@starting-style { a { opacity: 0 } }
				:where(x-a):state(open) > p { display: grid; color: light-dark(#000, #fff); height: 100dvh }
				@media (prefers-reduced-motion: reduce) { p { --custom: 1 } }`,
				'probe.css',
			),
		)
		for (const key of [
			'css.at-rules.starting-style',
			'css.selectors.where',
			'css.selectors.state',
			'css.properties.display.grid',
			'css.types.color.light-dark',
			'css.types.length.viewport_percentage_units_dynamic',
			'css.at-rules.media.prefers-reduced-motion',
		])
			expect(keys).toContain(key)
	})

	test('a Baseline 2024 selector fails a 2023 pin', () => {
		const report = evaluateBaseline(
			scanCss(':where(x-a):state(open) { color: red }', 'probe.css'),
			2023,
			{},
		)
		expect(report.violations.map(v => v.key)).toEqual(['css.selectors.state'])
	})

	test('an authored sheet is flattened before it is scanned', () => {
		const keys = keysOf(
			scanCss(flattenNesting('x-a { & p { display: grid } }'), 'x-a.css'),
		)
		expect(keys).toContain('css.properties.display.grid')
	})
})

describe('baseline judgement', () => {
	const use = (key: string) => ({ key, at: 'probe.ts:1:1', offset: 0 })

	test('an allowlisted key passes and is reported as allowed', () => {
		const report = evaluateBaseline([use('api.CustomStateSet.add')], 2023, {
			'api.CustomStateSet.add': 'guarded',
		})
		expect(report.violations).toEqual([])
		expect([...report.allowed.keys()]).toEqual(['api.CustomStateSet.add'])
		expect(report.stale).toEqual([])
	})

	test('an allowlist entry the scan never needs is stale', () => {
		const report = evaluateBaseline([use('api.CustomStateSet.add')], 2024, {
			'api.CustomStateSet.add': 'guarded',
		})
		expect(report.stale).toEqual(['api.CustomStateSet.add'])
	})

	test('the shipped allowlist names exact compat keys, each with a reason', () => {
		const index = compatIndex()
		for (const [key, reason] of Object.entries(BASELINE_ALLOWLIST)) {
			expect(index.has(key)).toBe(true)
			expect(reason.length).toBeGreaterThan(20)
		}
	})
})

describe('baseline pin', () => {
	const release = (version: string, baseline?: number) => ({
		version,
		baseline,
	})

	test('the pin must be a year', () => {
		expect(checkPin(release('3.0.0'), undefined)[0]).toContain(
			'"leTruc.baseline" must be a Baseline year',
		)
		expect(checkPin(release('3.0.0', 2023), undefined)).toEqual([])
	})

	test('bumping the year without a major version fails', () => {
		const problems = checkPin(release('3.1.0', 2024), release('3.0.0', 2023))
		expect(problems).toHaveLength(1)
		expect(problems[0]).toContain('without a major version bump')
		expect(
			checkPin(release('3.0.1-next.2', 2024), release('3.0.0', 2023)),
		).toHaveLength(1)
	})

	test('a minor or patch release keeps the year', () => {
		expect(checkPin(release('3.4.2', 2023), release('3.0.0', 2023))).toEqual([])
	})

	test('a major version may move the year', () => {
		expect(checkPin(release('4.0.0', 2026), release('3.9.0', 2023))).toEqual([])
	})

	test('a release that predates the pin constrains nothing', () => {
		expect(checkPin(release('3.0.0', 2023), release('2.6.0'))).toEqual([])
	})
})
