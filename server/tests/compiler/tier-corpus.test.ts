/**
 * Corpus-level tier assignment (ADR 0029, LT-165).
 *
 * `tier.test.ts` pins the routing RULE against synthetic inputs; this file
 * pins what the rule decides about the REAL corpus, which is the half that
 * can regress silently. A component drifting from the Folded tier to the
 * Simulated tier is a build-cost regression (ADR 0029 sub-design 6's whole
 * argument for the census); a component drifting the other way is a
 * correctness risk, since a false Folded classification ships wrong HTML
 * with no diagnostic.
 *
 * The full map is asserted rather than a sample: the acceptance criterion is
 * that the classifier assigns a tier to EVERY corpus component with a
 * recorded reason, and a partial assertion would let a new component land
 * unclassified.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { tierCensus } from '../../compiler/census'
import type { ComponentRegistry } from '../../compiler/registry'
import { compileCorpus } from '../../corpus-compile'
import { createGeneratedDir } from '../helpers/generated-corpus'
import { loadCorpus } from './corpus-fixture'

const generated = createGeneratedDir('tier-corpus')
afterAll(() => generated.cleanup())

// Compiled in beforeAll, not at module top level: a top-level await before
// describe() races the runner — under a heavier suite load (the tsrx-tsx
// parity file joined the run) registration landed after the run completed
// and the whole block silently never executed. Register synchronously; the
// corpus compile is setup, and setup belongs inside the lifecycle.
let registry: ComponentRegistry
beforeAll(async () => {
	await compileCorpus(await loadCorpus(), generated.path)
	registry = JSON.parse(
		await Bun.file(`${generated.path}/registry.json`).text(),
	) as ComponentRegistry
})

describe('tier assignment over the migrated corpus', () => {
	test('every component carries a tier', () => {
		expect(Object.keys(registry).length).toBeGreaterThan(0)
		for (const entry of Object.values(registry))
			expect(['folded', 'simulated', 'static']).toContain(entry.tier)
	})

	test('a non-Folded component always records why', () => {
		// The census is only useful if the reason survives with the tier —
		// "simulated, no reason given" is exactly the unexplained routing ADR
		// 0029 sub-design 6 replaced the warning channel to avoid.
		for (const entry of Object.values(registry)) {
			if (entry.tier === 'folded') expect(entry.routingSignals).toHaveLength(0)
			else expect(entry.routingSignals.length).toBeGreaterThan(0)
		}
	})

	test('LT-165 acceptance: the named Folded-tier components classify Folded', () => {
		for (const tag of [
			'basic-counter',
			'module-tabgroup',
			'card-blogpost',
			'card-callout',
		])
			expect(registry[tag]?.tier).toBe('folded')
	})

	test('LT-173 acceptance: basic-pluralize classifies Folded — the six standing signals dissolved', () => {
		// The flip this pin always anticipated: the reserved `i18n` parameter
		// (ADR 0030) makes the locale server-known, so `Intl.PluralRules` folds
		// (LT-142) and the six LTC034 routing signals — one per category
		// span's `hidden` thunk, each "locale read from the DOM" — are gone.
		// If a NEW signal ever appears here, the fold rule or the classifier
		// moved underneath the component; investigate rather than reclassify.
		expect(registry['basic-pluralize']?.tier).toBe('folded')
		expect(registry['basic-pluralize']?.routingSignals).toHaveLength(0)
	})

	test('contamination reached form-combobox through a compose READ', () => {
		// The only corpus instance of sub-design 3 today: form-combobox reads
		// its composed form-listbox rather than merely containing it.
		const signals = registry['form-combobox']?.routingSignals ?? []
		expect(signals.some(signal => signal.origin === 'compose-read')).toBe(true)
	})

	test('the full tier map is what the classifier currently decides', () => {
		const byTier: Record<string, string[]> = {
			folded: [],
			simulated: [],
			static: [],
		}
		for (const [tag, entry] of Object.entries(registry))
			byTier[entry.tier]?.push(tag)
		for (const tags of Object.values(byTier)) tags.sort()
		expect(byTier).toEqual({
			folded: [
				'basic-button',
				'basic-counter',
				'basic-gauge',
				'basic-hello',
				'basic-number',
				'basic-pluralize',
				'card-blogpost',
				'card-callout',
				'card-collapsible',
				'card-colorscale',
				'card-mediaqueries',
				'form-checkbox',
				'form-colorgraph',
				'form-inplace-edit',
				'form-radiogroup',
				'form-spinbutton',
				'form-textbox',
				'form-tokenbox',
				'module-codeblock',
				'module-colorinfo',
				'module-dialog',
				'module-list',
				'module-pagination',
				'module-splitview',
				'module-tabgroup',
			],
			simulated: [
				'form-combobox',
				'form-listbox',
				'module-catalog',
				'module-scrollarea',
			],
			static: [],
		})
	})
})

describe('the tier census (LT-165 step 6, ADR 0029 sub-design 6)', () => {
	// Built from the registry the corpus runner wrote — which the fixpoint in
	// `compileCorpus` updated BEFORE the write, so the census records
	// POST-contamination tiers by construction (the architect ruling for
	// step 6). Built inside each test, not eagerly at describe registration:
	// the describe body runs before `beforeAll` has compiled the corpus, and
	// the eager `tierCensus(Object.values(registry))` threw on the undefined
	// registry — bun surfaced it as one "error between tests" while this
	// whole block silently never registered.
	const censusOf = () => tierCensus(Object.values(registry))

	test('every corpus component appears exactly once, with its final tier', () => {
		const census = censusOf()
		expect(census.entries.map(entry => entry.subject).sort()).toEqual(
			Object.keys(registry).sort(),
		)
		for (const entry of census.entries)
			expect(entry.value).toBe(registry[entry.subject]!.tier)
	})

	test('folded entries carry no reasons; non-folded entries carry at least one', () => {
		const census = censusOf()
		for (const entry of census.entries) {
			if (entry.value === 'folded') expect(entry.reasons).toEqual([])
			else expect(entry.reasons.length).toBeGreaterThan(0)
		}
	})

	test('form-combobox is recorded Simulated — the post-contamination tier, with its compose-read reason', () => {
		// The step-6 ruling: emit receives the PRE-contamination tier (index.ts
		// classifies before the corpus fixpoint runs), so form-combobox —
		// Folded by its own signals, Simulated purely through its compose READ
		// of form-listbox — must be census-recorded Simulated with the
		// compose-read signal as the reason, not the pre-contamination Folded
		// tier its emit used.
		const census = censusOf()
		const entry = census.entries.find(e => e.subject === 'form-combobox')
		expect(entry?.value).toBe('simulated')
		expect(
			entry?.reasons.some(reason => reason.startsWith('compose-read: ')),
		).toBe(true)
	})
})
