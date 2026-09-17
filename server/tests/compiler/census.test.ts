/**
 * The census surface of the build-report channel (ADR 0029 sub-design 6,
 * LT-165 step 6).
 *
 * `tier.test.ts` pins the routing RULE and `tier-corpus.test.ts` pins what
 * it decides about the REAL corpus; this file pins the census RECORD itself —
 * the named-census shape both planned censuses ride (the tier census here,
 * the translation census under LT-173 step 4) and its formatting. The census
 * is a build-report record, not a diagnostic: its wording stays factual
 * (tag, tier, reasons — ADR 0028), and it must never enter the diagnostic
 * channel the LT-163 baseline gates (pinned corpus-wide in
 * `sim-driver.test.ts`).
 */

import { describe, expect, test } from 'bun:test'
import {
	formatCensus,
	type TierCensusSubject,
	tierCensus,
} from '../../compiler/sim/report'
import type { RoutingSignal } from '../../compiler/tier'

/* === Helpers === */

const signal = (
	origin: RoutingSignal['origin'],
	detail: string,
	line?: number,
): RoutingSignal => ({
	origin,
	detail,
	resolution: { by: 'realm' },
	...(line === undefined ? {} : { line }),
})

const subject = (
	tag: string,
	tier: TierCensusSubject['tier'],
	routingSignals: RoutingSignal[] = [],
): TierCensusSubject => ({ tag, tier, routingSignals })

/* === Tests === */

describe('tierCensus', () => {
	test('entries are sorted by tag, whatever order the registry emits them in', () => {
		const census = tierCensus([
			subject('form-b', 'simulated', [signal('TSRX034', 'x')]),
			subject('basic-a', 'folded'),
		])
		expect(census.entries.map(entry => entry.subject)).toEqual([
			'basic-a',
			'form-b',
		])
	})

	test('every entry records its tier as the census value', () => {
		const census = tierCensus([
			subject('basic-a', 'folded'),
			subject('form-b', 'simulated'),
			subject('module-c', 'static'),
		])
		expect(census.entries.map(entry => entry.value)).toEqual([
			'folded',
			'simulated',
			'static',
		])
	})

	test('a routing signal becomes a factual reason: origin, detail, and the line when known', () => {
		const census = tierCensus([
			subject('form-b', 'simulated', [
				signal('TSRX004', 'no harvestable render site'),
				signal(
					'compose-read',
					'reads composed <basic-a> (folded-tier) at a compose site',
					7,
				),
			]),
		])
		expect(census.entries[0]?.reasons).toEqual([
			'TSRX004: no harvestable render site',
			'compose-read: reads composed <basic-a> (folded-tier) at a compose site (line 7)',
		])
	})

	test('a Folded-tier subject carries no reasons — that is the fact', () => {
		const census = tierCensus([subject('basic-a', 'folded')])
		expect(census.entries[0]?.reasons).toEqual([])
	})
})

describe('formatCensus', () => {
	const census = tierCensus([
		subject('basic-a', 'folded'),
		subject('basic-b', 'folded'),
		subject('form-c', 'simulated', [
			signal('TSRX004', 'no harvestable render site'),
		]),
	])

	test('the summary line counts every entry, including zero-count tiers', () => {
		// "0 static" is a meaningful fact, not a gap: the empty Static census
		// is the current corpus's correct classification (ADR 0029
		// Consequences), and the count is what makes its emptiness visible.
		expect(formatCensus(census).split('\n')[0]).toBe(
			'Tier census — 3 entries: 2 folded, 1 simulated, 0 static',
		)
	})

	test('a reason-less entry is counted but not listed — its line would say nothing the count does not', () => {
		const text = formatCensus(census)
		expect(text).not.toContain('basic-a')
		expect(text).not.toContain('basic-b')
	})

	test('an entry with reasons lists them under its subject', () => {
		const text = formatCensus(census)
		expect(text).toContain('  form-c: simulated')
		expect(text).toContain('    - TSRX004: no harvestable render site')
	})

	test('the format is stable — the census regression story reads this output', () => {
		expect(formatCensus(census)).toBe(
			'Tier census — 3 entries: 2 folded, 1 simulated, 0 static\n' +
				'  form-c: simulated\n' +
				'    - TSRX004: no harvestable render site',
		)
	})

	test('census lines never carry the warning marker the counted baseline reads', () => {
		// `check:tsrx` counts console.warn lines that start with ⚠️; the
		// census is not a warning (ADR 0029 sub-design 6) and must never be
		// countable as one.
		expect(formatCensus(census)).not.toContain('⚠️')
	})
})
