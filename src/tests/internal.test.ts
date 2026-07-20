/**
 * Unit tests for the ambient effect-descriptor collector in src/internal.ts.
 *
 * See ADR 0018: watch()/on()/pass()/each()/provideContexts() push descriptors
 * into whatever collector `withCollector()` currently has active, instead of
 * (or in addition to, for backward compatibility) returning them for the
 * factory to collect. This file tests the collection primitive itself, not
 * any of the helpers that will be wired to use it.
 */

import { describe, expect, test } from 'bun:test'
import { NoActiveCollectorError } from '../errors'
import { pushDescriptor, withCollector } from '../internal'
import type { EffectDescriptor } from '../types'

const host = {
	localName: 'my-element',
	id: '',
	classList: { length: 0 },
} as unknown as HTMLElement

const descriptor: EffectDescriptor = () => undefined

describe('pushDescriptor', () => {
	test('throws NoActiveCollectorError when no collector is active', () => {
		expect(() => pushDescriptor(host, 'watch', descriptor)).toThrow(
			NoActiveCollectorError,
		)
	})

	test('error message names the helper and the host', () => {
		try {
			pushDescriptor(host, 'watch', descriptor)
			throw new Error('expected pushDescriptor to throw')
		} catch (e) {
			expect(e).toBeInstanceOf(NoActiveCollectorError)
			expect((e as Error).message).toContain('watch()')
			expect((e as Error).message).toContain('<my-element>')
		}
	})

	test('pushes into the active collector', () => {
		const collector: EffectDescriptor[] = []
		withCollector(collector, () => {
			pushDescriptor(host, 'watch', descriptor)
		})
		expect(collector).toEqual([descriptor])
	})

	test('pushes multiple descriptors in call order', () => {
		const collector: EffectDescriptor[] = []
		const second: EffectDescriptor = () => undefined
		withCollector(collector, () => {
			pushDescriptor(host, 'watch', descriptor)
			pushDescriptor(host, 'on', second)
		})
		expect(collector).toEqual([descriptor, second])
	})
})

describe('withCollector', () => {
	test('returns the callback result', () => {
		const result = withCollector([], () => 42)
		expect(result).toBe(42)
	})

	test('restores the previous collector after returning', () => {
		const outer: EffectDescriptor[] = []
		withCollector(outer, () => {
			const inner: EffectDescriptor[] = []
			withCollector(inner, () => {
				pushDescriptor(host, 'each', descriptor)
			})
			expect(inner).toEqual([descriptor])
			pushDescriptor(host, 'watch', descriptor)
		})
		expect(outer).toEqual([descriptor])
	})

	test('restores the previous collector even if the callback throws', () => {
		const outer: EffectDescriptor[] = []
		withCollector(outer, () => {
			expect(() =>
				withCollector([], () => {
					throw new Error('boom')
				}),
			).toThrow('boom')
			// Outer collector must still be active after the inner throw unwound.
			pushDescriptor(host, 'watch', descriptor)
		})
		expect(outer).toEqual([descriptor])
	})

	test('deactivates the collector entirely once the outermost call returns', () => {
		withCollector([], () => {
			/* no-op */
		})
		expect(() => pushDescriptor(host, 'watch', descriptor)).toThrow(
			NoActiveCollectorError,
		)
	})

	test('supports arbitrary nesting depth (grid-like structures)', () => {
		const collectors: EffectDescriptor[][] = []
		const nest = (depth: number): void => {
			const collector: EffectDescriptor[] = []
			collectors.push(collector)
			withCollector(collector, () => {
				pushDescriptor(host, 'watch', descriptor)
				if (depth > 0) nest(depth - 1)
			})
		}
		nest(5)
		expect(collectors).toHaveLength(6)
		for (const collector of collectors) expect(collector).toEqual([descriptor])
	})
})
