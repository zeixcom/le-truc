/**
 * Unit tests for src/helpers/dom.ts
 *
 * No real DOM is available under `bun test`, so `createElementsMemo` is
 * exercised against a minimal `ParentNode` stub that only implements
 * `querySelector`/`querySelectorAll` — mirroring the stub-DOM style used
 * in events.test.ts and context.test.ts.
 */

import { describe, expect, test } from 'bun:test'
import { InvalidSelectorError, MissingElementError } from '../errors'
import {
	createElementsMemo,
	extractAttributes,
	makeElementQueries,
	query,
	queryAll,
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

describe('query', () => {
	test('returns the first matching element', () => {
		const el = { localName: 'span' } as unknown as HTMLSpanElement
		const parent = makeParent(() => el)
		expect(query(parent, 'span')).toBe(el)
	})

	test('returns undefined when optional and missing', () => {
		const parent = makeParent(() => null)
		expect(query(parent, '.missing')).toBeUndefined()
	})

	test('throws MissingElementError with default contextLabel when required and missing', () => {
		const parent = makeParent(() => null)
		expect(() => query(parent, '.missing', 'needed for X')).toThrow(
			MissingElementError,
		)
		expect(() => query(parent, '.missing', 'needed for X')).toThrow(
			/in component /,
		)
	})
})

describe('queryAll', () => {
	test('returns a plain array of matches', () => {
		const el = { localName: 'li' } as unknown as HTMLLIElement
		const parent = {
			querySelector: () => null,
			querySelectorAll: () => [el] as unknown as NodeListOf<Element>,
		} as unknown as ParentNode
		const result = queryAll(parent, 'li')
		expect(Array.isArray(result)).toBe(true)
		expect(result).toEqual([el])
	})

	test('returns an empty array when optional and no matches', () => {
		const parent = makeParent(() => null)
		expect(queryAll(parent, '.missing')).toEqual([])
	})

	test('throws MissingElementError when required and no matches', () => {
		const parent = makeParent(() => null)
		expect(() => queryAll(parent, '.missing', 'needed for X')).toThrow(
			MissingElementError,
		)
	})
})

describe('makeElementQueries first/all delegate to query/queryAll unchanged', () => {
	test('first() still throws MissingElementError with "in component" wording', () => {
		const host = {
			localName: 'my-host',
			shadowRoot: null,
			querySelector: (_selector: string) => null,
		} as unknown as HTMLElement
		const [{ first }] = makeElementQueries(host)
		expect(() => first('.missing', 'needed for X')).toThrow(MissingElementError)
		expect(() => first('.missing', 'needed for X')).toThrow(/in component /)
	})

	test('first() still returns undefined when optional and missing', () => {
		const host = {
			localName: 'my-host',
			shadowRoot: null,
			querySelector: (_selector: string) => null,
		} as unknown as HTMLElement
		const [{ first }] = makeElementQueries(host)
		expect(first('.missing')).toBeUndefined()
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

describe('resolveDependencies defers for a registered-but-uninitialized child', () => {
	// Regression for the detached-subtree timing bug: when a whole nested
	// parent+child subtree is built detached then appended in one operation
	// (e.g. lit-html/Storybook's render path), the browser queues the
	// connectedCallbacks in tree order — the parent's fires first. The child
	// is already `:defined` (its class is registered) but its own
	// connectedCallback — and therefore its expose()/Slot setup — hasn't run
	// yet. If `resolveDependencies` runs the parent's setup (which calls
	// `pass()` → `swapSlots`) synchronously, `pass()` throws
	// `InvalidPassPropertyError` because `'prop' in child` is still false.
	//
	// Fix: when `first()`/`all()` query any `:defined` custom-element child,
	// `resolveDependencies` must defer setup to a microtask so the child's
	// queued connectedCallback drains first. No real DOM is available under
	// `bun test`, so this verifies the deferral *mechanism*: a queried
	// `:defined` custom element makes the callback run on a microtask, not
	// synchronously. End-to-end browser verification was done separately.
	test('defers the callback to a microtask when first() matches a defined custom element', async () => {
		const originalCustomElements = (globalThis as any).customElements
		;(globalThis as any).customElements = {
			// The child's class IS registered (the precondition for the bug).
			get: (_name: string) => function DefinedChild() {},
			whenDefined: (_name: string) => Promise.resolve(),
		}

		try {
			// A custom element that matches `:defined` (class registered) but
			// whose own setup hasn't run yet — exactly the race window.
			const definedChild = {
				localName: 'defined-child',
				matches: (selector: string) => selector !== ':not(:defined)',
			} as unknown as Element
			const host = {
				localName: 'parent-host',
				shadowRoot: null,
				querySelector: (_selector: string) => definedChild,
			} as unknown as HTMLElement

			const [{ first }, resolveDependencies] = makeElementQueries(host)
			first('defined-child')

			const calls: string[] = []
			resolveDependencies(() => calls.push('callback'))

			// The callback must NOT have run synchronously — it must be
			// deferred so the child's queued connectedCallback can drain first.
			expect(calls).toEqual([])

			// After the microtask drains, the callback runs exactly once.
			await Promise.resolve()
			expect(calls).toEqual(['callback'])
		} finally {
			;(globalThis as any).customElements = originalCustomElements
		}
	})

	test('defers the callback to a microtask when all() matches a defined custom element', async () => {
		const originalCustomElements = (globalThis as any).customElements
		;(globalThis as any).customElements = {
			get: (_name: string) => function DefinedChild() {},
			whenDefined: (_name: string) => Promise.resolve(),
		}

		try {
			const definedChild = {
				localName: 'defined-child',
				matches: (selector: string) => selector !== ':not(:defined)',
				// createElementsMemo walks the parent via querySelectorAll
				querySelector: () => null,
				querySelectorAll: () => [] as unknown as NodeListOf<Element>,
			} as unknown as Element
			const host = {
				localName: 'parent-host',
				shadowRoot: null,
				querySelector: () => null,
				querySelectorAll: () =>
					[definedChild] as unknown as NodeListOf<Element>,
			} as unknown as HTMLElement

			const [{ all }, resolveDependencies] = makeElementQueries(host)
			all('defined-child')

			const calls: string[] = []
			resolveDependencies(() => calls.push('callback'))

			expect(calls).toEqual([])
			await Promise.resolve()
			expect(calls).toEqual(['callback'])
		} finally {
			;(globalThis as any).customElements = originalCustomElements
		}
	})

	test('runs the callback synchronously when no custom-element child was queried', () => {
		// A plain (non-custom) element must not trigger the deferral.
		const originalCustomElements = (globalThis as any).customElements
		;(globalThis as any).customElements = {
			get: (_name: string) => undefined,
			whenDefined: (_name: string) => Promise.resolve(),
		}

		try {
			const plainElement = {
				localName: 'div', // not a custom element
				matches: () => false,
			} as unknown as Element
			const host = {
				localName: 'parent-host',
				shadowRoot: null,
				querySelector: (_selector: string) => plainElement,
			} as unknown as HTMLElement

			const [{ first }, resolveDependencies] = makeElementQueries(host)
			first('div')

			const calls: string[] = []
			resolveDependencies(() => calls.push('callback'))

			// No custom-element child → no deferral → synchronous.
			expect(calls).toEqual(['callback'])
		} finally {
			;(globalThis as any).customElements = originalCustomElements
		}
	})
})
