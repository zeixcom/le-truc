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

import { afterAll, describe, expect, test } from 'bun:test'
import { compileTsrxCorpus } from '../../effects/tsrx'
import type { ComponentRegistry } from '../../tsrx/registry'
import { createGeneratedDir } from '../helpers/generated-tsrx'
import { loadTsrxCorpus } from './corpus-fixture'

const generated = createGeneratedDir('tier-corpus')
afterAll(() => generated.cleanup())

await compileTsrxCorpus(await loadTsrxCorpus(), generated.path)
const registry = JSON.parse(
	await Bun.file(`${generated.path}/registry.json`).text(),
) as ComponentRegistry

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

	test('LT-165 acceptance: basic-pluralize stays Simulated-tier', () => {
		// LT-142's middle case: the locale is read from the DOM
		// (`getLocale(el)`), which the realm executes for real. It becomes
		// Folded-tier eligible only once ADR 0030's reserved `i18n` parameter
		// makes the locale server-known — LT-173, which expects to flip this
		// pin rather than to preserve it.
		expect(registry['basic-pluralize']?.tier).toBe('simulated')
		expect(
			registry['basic-pluralize']?.routingSignals.every(
				signal => signal.resolution.by === 'realm',
			),
		).toBe(true)
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
				'module-list',
				'module-tabgroup',
			],
			simulated: ['basic-pluralize', 'form-combobox', 'form-listbox'],
			static: [],
		})
	})
})
