/**
 * Unit tests for src/helpers/dom.ts
 *
 * No real DOM is available under `bun test`, so `createElementsMemo` is
 * exercised against a minimal `ParentNode` stub that only implements
 * `querySelector`/`querySelectorAll` — mirroring the stub-DOM style used
 * in events.test.ts and context.test.ts.
 */

import { describe, expect, test } from 'bun:test'
import { InvalidSelectorError } from '../errors'
import {
	createElementsMemo,
	extractAttributes,
	makeElementQueries,
} from '../helpers/dom'

const makeParent = (
	querySelector: (selector: string) => Element | null = () => null,
): ParentNode =>
	({
		querySelector,
		querySelectorAll: () => [] as unknown as NodeListOf<Element>,
	}) as unknown as ParentNode

describe('extractAttributes', () => {
	test('detects class shorthand', () => {
		expect(extractAttributes('.foo')).toContain('class')
	})

	test('detects id shorthand', () => {
		expect(extractAttributes('#bar')).toContain('id')
	})

	test('extracts attribute name from [attr]', () => {
		expect(extractAttributes('[disabled]')).toContain('disabled')
	})

	test('extracts attribute name from [attr=value]', () => {
		expect(extractAttributes('[type=text]')).toContain('type')
	})

	test('does not produce false positive for # inside attribute value', () => {
		// [attr^="#anchor"] contains # inside the selector — must not trigger id detection
		expect(extractAttributes('[href^="#anchor"]')).not.toContain('id')
		expect(extractAttributes('[href^="#anchor"]')).toContain('href')
	})

	test('does not produce false positive for . inside attribute value', () => {
		// The . is inside the value — must not add 'class' as a shorthand detection,
		// but 'href' IS the attribute name so it appears via the [attr] extraction path.
		expect(extractAttributes('[href^="file.pdf"]')).not.toContain('class')
		expect(extractAttributes('[href^="file.pdf"]')).toContain('href')
	})

	test('handles combined selector', () => {
		const attrs = extractAttributes('.nav[aria-expanded]#main')
		expect(attrs).toContain('class')
		expect(attrs).toContain('id')
		expect(attrs).toContain('aria-expanded')
	})

	test('completes in linear time on pathological input with no closing bracket', () => {
		// ReDoS guard: must not hang on a long string of '[' without ']'
		const input = '['.repeat(10_000)
		const start = performance.now()
		extractAttributes(input)
		const elapsed = performance.now() - start
		expect(elapsed).toBeLessThan(100) // well under 100 ms
	})
})

describe('createElementsMemo', () => {
	test('throws InvalidSelectorError at creation for a malformed selector', () => {
		const parent = makeParent(() => {
			throw new DOMException("':bad[' is not a valid selector.", 'SyntaxError')
		})
		expect(() => createElementsMemo(parent, ':bad[')).toThrow(
			InvalidSelectorError,
		)
	})

	test('error message names the malformed selector', () => {
		const parent = makeParent(() => {
			throw new DOMException("':bad[' is not a valid selector.", 'SyntaxError')
		})
		expect(() => createElementsMemo(parent, ':bad[')).toThrow(/:bad\[/)
	})

	test('valid selectors are unaffected', () => {
		const parent = makeParent(() => null)
		expect(() => createElementsMemo(parent, 'div.foo')).not.toThrow()
	})
})

describe('resolveDependencies timeout path', () => {
	// `first()`/`all()` add a dependency's tag name when the matched element is
	// an undefined custom element. `resolveDependencies` then races
	// `customElements.whenDefined()` against a 200ms timeout; on timeout it
	// logs (DEV_MODE only) and runs the callback anyway — a single missing
	// dependency must never block the component indefinitely.
	test('falls back to running the callback after the real 200ms timeout', async () => {
		const originalCustomElements = (globalThis as any).customElements
		;(globalThis as any).customElements = {
			get: (_name: string) => undefined,
			whenDefined: (_name: string) => new Promise(() => {}), // never resolves
		}

		try {
			const fakeDep = {
				localName: 'my-dep',
				matches: (selector: string) => selector === ':not(:defined)',
			} as unknown as Element
			const host = {
				localName: 'my-host',
				shadowRoot: null,
				querySelector: (_selector: string) => fakeDep,
			} as unknown as HTMLElement

			const [{ first }, resolveDependencies] = makeElementQueries(host)
			first('my-dep')

			const calls: string[] = []
			resolveDependencies(() => calls.push('callback'))

			// Real wait: DEPENDENCY_TIMEOUT (200ms) is an internal constant, not
			// configurable from outside.
			await new Promise(r => setTimeout(r, 260))
			expect(calls).toEqual(['callback'])
		} finally {
			;(globalThis as any).customElements = originalCustomElements
		}
	}, 1000)
})
