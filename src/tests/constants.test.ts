/**
 * Unit tests for shared timing constants in src/internal.ts
 *
 * Pure value comparisons — no DOM required.
 */

import { describe, expect, test } from 'bun:test'
import { CONTEXT_RETRY_DELAY, DEPENDENCY_TIMEOUT } from '../internal'

describe('timing invariants', () => {
	test('CONTEXT_RETRY_DELAY strictly exceeds DEPENDENCY_TIMEOUT', () => {
		// Guards ADR-0015's late-provider retry. If the retry fires before
		// the dependency window closes, late providers are missed and
		// consumers permanently lock in their fallback.
		expect(CONTEXT_RETRY_DELAY).toBeGreaterThan(DEPENDENCY_TIMEOUT)
	})

	test('the margin between the two is at least 5 ms', () => {
		// The margin covers event-loop scheduling jitter between the
		// dependency timeout firing and the provider's listener activating.
		// A margin of 0-4 ms is fragile; flag it for human review.
		expect(CONTEXT_RETRY_DELAY - DEPENDENCY_TIMEOUT).toBeGreaterThanOrEqual(5)
	})
})
