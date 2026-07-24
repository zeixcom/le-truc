/**
 * Unit tests for reconcile() in src/helpers/reactive.ts
 *
 * No real DOM is available under `bun test`, so reconcile() is exercised
 * against a minimal fake element implementing exactly the DOM surface the
 * reconciler uses: `children`, `firstElementChild`, `nextElementSibling`,
 * `insertBefore`, `remove`, `cloneNode`, and the attribute methods —
 * mirroring the stub-DOM style used in component.test.ts and dom.test.ts.
 * The `<template>` is a stub exposing only `content.childElementCount` and
 * `content.firstElementChild`.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
	createCollection,
	createList,
	createScope,
	createState,
	type Signal,
} from '@zeix/cause-effect'
import { InvalidTemplateError } from '../errors'
import { makeWatch, reconcile } from '../helpers/reactive'
import { installActiveCollector, restoreActiveCollector } from '../internal'
import type { ComponentProps, EffectDescriptor } from '../types'

// reconcile() pushes into the currently active effect-descriptor collector
// (ADR 0018) and throws NoActiveCollectorError if none is active. These
// tests call it directly, outside `defineComponent`'s factory execution, so
// install a throwaway collector for the duration of the file.
let previousCollector: EffectDescriptor[] | undefined
beforeEach(() => {
	previousCollector = installActiveCollector([])
})
afterEach(() => {
	restoreActiveCollector(previousCollector)
})

/* === Fake DOM === */

class FakeElement {
	localName: string
	#attrs = new Map<string, string>()
	childElements: FakeElement[] = []
	parent: FakeElement | null = null

	constructor(localName = 'div') {
		this.localName = localName
	}

	get children(): FakeElement[] {
		return this.childElements
	}
	get firstElementChild(): FakeElement | null {
		return this.childElements[0] ?? null
	}
	get nextElementSibling(): FakeElement | null {
		if (!this.parent) return null
		const index = this.parent.childElements.indexOf(this)
		return this.parent.childElements[index + 1] ?? null
	}

	getAttribute(name: string): string | null {
		return this.#attrs.get(name) ?? null
	}
	setAttribute(name: string, value: string) {
		this.#attrs.set(name, value)
	}
	hasAttribute(name: string): boolean {
		return this.#attrs.has(name)
	}
	removeAttribute(name: string) {
		this.#attrs.delete(name)
	}

	insertBefore(el: FakeElement, ref: FakeElement | null): FakeElement {
		el.remove()
		const index = ref ? this.childElements.indexOf(ref) : -1
		if (index === -1) this.childElements.push(el)
		else this.childElements.splice(index, 0, el)
		el.parent = this
		return el
	}
	appendChild(el: FakeElement): FakeElement {
		return this.insertBefore(el, null)
	}
	remove() {
		if (!this.parent) return
		const index = this.parent.childElements.indexOf(this)
		if (index !== -1) this.parent.childElements.splice(index, 1)
		this.parent = null
	}

	cloneNode(deep: boolean): FakeElement {
		const copy = new FakeElement(this.localName)
		for (const [name, value] of this.#attrs) copy.setAttribute(name, value)
		if (deep)
			for (const child of this.childElements)
				copy.appendChild(child.cloneNode(true))
		return copy
	}
}

const makeTemplate = (rootCount = 1): HTMLTemplateElement => {
	const roots = Array.from({ length: rootCount }, () => new FakeElement('li'))
	return {
		content: {
			get childElementCount() {
				return roots.length
			},
			get firstElementChild() {
				return roots[0] ?? null
			},
		},
	} as unknown as HTMLTemplateElement
}

const keyedChild = (key: string, localName = 'li'): FakeElement => {
	const el = new FakeElement(localName)
	el.setAttribute('data-key', key)
	return el
}

const childKeys = (container: FakeElement): (string | null)[] =>
	container.children.map(el => el.getAttribute('data-key'))

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

type BindCall = { key: string; element: FakeElement; value: unknown }

const makeBindRecorder = () => {
	const mounted: BindCall[] = []
	const disposed: string[] = []
	const bindItem = (
		element: HTMLElement,
		item: Signal<NonNullable<unknown>>,
		key: string,
	) => {
		mounted.push({
			key,
			element: element as unknown as FakeElement,
			value: item.get(),
		})
		return () => {
			disposed.push(key)
		}
	}
	return { mounted, disposed, bindItem }
}

/* === Tests === */

describe('reconcile — template validation', () => {
	test('throws InvalidTemplateError when template content is empty', () => {
		const container = new FakeElement('ul')
		const list = createList<string>(['a'], { keyConfig: 'item' })
		const descriptor = reconcile(
			container as unknown as Element,
			makeTemplate(0),
			list,
			() => {},
		)
		expect(() => createScope(() => descriptor())).toThrow(InvalidTemplateError)
	})

	test('throws InvalidTemplateError when template content has two root elements', () => {
		const container = new FakeElement('ul')
		const list = createList<string>(['a'], { keyConfig: 'item' })
		const descriptor = reconcile(
			container as unknown as Element,
			makeTemplate(2),
			list,
			() => {},
		)
		expect(() => createScope(() => descriptor())).toThrow(InvalidTemplateError)
	})
})

describe('reconcile — first run', () => {
	test('clones the template root for each key in source order', () => {
		const container = new FakeElement('ul')
		const list = createList<string>(['a', 'b', 'c'], { keyConfig: 'item' })
		const { mounted, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				bindItem,
			)(),
		)

		expect(childKeys(container)).toEqual(['item0', 'item1', 'item2'])
		expect(container.children.every(el => el.localName === 'li')).toBe(true)
		expect(mounted.map(c => c.key)).toEqual(['item0', 'item1', 'item2'])
		expect(mounted.map(c => c.value)).toEqual(['a', 'b', 'c'])
		dispose()
	})

	test('adopts existing keyed children and mounts bindItem for them', () => {
		const container = new FakeElement('ul')
		const serverRendered = keyedChild('item0')
		container.appendChild(serverRendered)
		const list = createList<string>(['a', 'b'], { keyConfig: 'item' })
		const { mounted, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				bindItem,
			)(),
		)

		expect(childKeys(container)).toEqual(['item0', 'item1'])
		// Adopted element is reused, not replaced by a clone
		expect(container.children[0]).toBe(serverRendered)
		expect(mounted.map(c => c.key)).toEqual(['item0', 'item1'])
		expect(mounted[0]?.element).toBe(serverRendered)
		dispose()
	})

	test('removes keyed children whose key is not in the source and unkeyed children', () => {
		const container = new FakeElement('ul')
		container.appendChild(keyedChild('stale'))
		container.appendChild(new FakeElement('li')) // unkeyed
		container.appendChild(keyedChild('item0'))
		const list = createList<string>(['a'], { keyConfig: 'item' })

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				() => {},
			)(),
		)

		expect(childKeys(container)).toEqual(['item0'])
		dispose()
	})

	test('leaves data-unreconciled children untouched and does not mount bindItem on them', () => {
		const container = new FakeElement('ul')
		const streamed = keyedChild('item0')
		streamed.setAttribute('data-unreconciled', '')
		container.appendChild(streamed)
		const list = createList<string>(['a'], { keyConfig: 'item' })
		const { mounted, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				bindItem,
			)(),
		)

		// The unreconciled child is kept as-is; a fresh clone is created for the
		// key because unreconciled elements are structurally invisible.
		expect(container.children).toContain(streamed)
		expect(mounted.map(c => c.element)).not.toContain(streamed)
		expect(mounted.map(c => c.key)).toEqual(['item0'])
		dispose()
	})
})

describe('reconcile — enter, leave, move', () => {
	test('entering key appends a cloned element and mounts bindItem', async () => {
		const container = new FakeElement('ul')
		const list = createList<string>(['a'], { keyConfig: 'item' })
		const { mounted, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				bindItem,
			)(),
		)

		list.add('b')
		await tick()

		expect(childKeys(container)).toEqual(['item0', 'item1'])
		expect(mounted.map(c => c.key)).toEqual(['item0', 'item1'])
		dispose()
	})

	test('leaving key disposes its scope and removes its element', async () => {
		const container = new FakeElement('ul')
		const list = createList<string>(['a', 'b'], { keyConfig: 'item' })
		const { mounted, disposed, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				bindItem,
			)(),
		)

		list.remove('item0')
		await tick()

		expect(childKeys(container)).toEqual(['item1'])
		expect(disposed).toEqual(['item0'])
		// Surviving element was not re-mounted
		expect(mounted.map(c => c.key)).toEqual(['item0', 'item1'])
		dispose()
	})

	test('reorder reuses existing nodes and never re-mounts', async () => {
		type Item = { id: string; label: string }
		const container = new FakeElement('ul')
		const list = createList<Item>(
			[
				{ id: 'x', label: 'X' },
				{ id: 'y', label: 'Y' },
				{ id: 'z', label: 'Z' },
			],
			{ keyConfig: item => item.id },
		)
		const { mounted, disposed, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				bindItem,
			)(),
		)
		const [elX, elY, elZ] = container.children

		list.update(prev => [prev[2]!, prev[0]!, prev[1]!])
		await tick()

		expect(childKeys(container)).toEqual(['z', 'x', 'y'])
		expect(container.children[0]).toBe(elZ!)
		expect(container.children[1]).toBe(elX!)
		expect(container.children[2]).toBe(elY!)
		expect(mounted.length).toBe(3)
		expect(disposed).toEqual([])
		dispose()
	})

	test('re-running against a matching DOM is a no-op', async () => {
		const container = new FakeElement('ul')
		const list = createList<string>(['a', 'b'], { keyConfig: 'item' })
		const { mounted, disposed, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				bindItem,
			)(),
		)
		const before = [...container.children]

		// Item value change flows through the item signal, not structure
		list.replace('item0', 'a2')
		await tick()

		expect([...container.children]).toEqual(before)
		expect(mounted.length).toBe(2)
		expect(disposed).toEqual([])
		dispose()
	})
})

describe('reconcile — keyed-relative positioning', () => {
	test('a reconciled element that turns data-unreconciled keeps claiming its key', async () => {
		type Item = { id: string }
		const container = new FakeElement('ul')
		const list = createList<Item>([{ id: 'x' }, { id: 'y' }], {
			keyConfig: item => item.id,
		})
		const { mounted, disposed, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				bindItem,
			)(),
		)

		// Mid-drag: the dragged item is pinned by the event handlers
		const dragged = container.children[0]!
		dragged.setAttribute('data-unreconciled', '')

		// A list mutation fires mid-drag from another path
		list.add({ id: 'z' })
		await tick()

		// No duplicate clone for the pinned key, no re-mount, no disposal
		expect(childKeys(container)).toEqual(['x', 'y', 'z'])
		expect(container.children[0]).toBe(dragged)
		expect(mounted.map(c => c.key)).toEqual(['x', 'y', 'z'])
		expect(disposed).toEqual([])

		// Drop: the pin is stripped and the next run repositions normally
		dragged.removeAttribute('data-unreconciled')
		list.update(prev => [prev[1]!, prev[0]!, prev[2]!])
		await tick()
		expect(childKeys(container)).toEqual(['y', 'x', 'z'])
		expect(container.children[1]).toBe(dragged)
		expect(disposed).toEqual([])
		dispose()
	})

	test('interspersed data-unreconciled elements are neither removed nor repositioned', async () => {
		type Item = { id: string }
		const container = new FakeElement('ul')
		const list = createList<Item>([{ id: 'x' }, { id: 'y' }], {
			keyConfig: item => item.id,
		})

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				() => {},
			)(),
		)

		// Simulate a transient marker between the two keyed items
		const marker = new FakeElement('li')
		marker.setAttribute('data-unreconciled', '')
		const elY = container.children[1]!
		container.insertBefore(marker, elY)
		expect(childKeys(container)).toEqual(['x', null, 'y'])

		// Reorder: y before x — marker must survive, keyed subset must be y, x
		list.update(prev => [prev[1]!, prev[0]!])
		await tick()

		expect(container.children).toContain(marker)
		const keyed = childKeys(container).filter(key => key !== null)
		expect(keyed).toEqual(['y', 'x'])
		dispose()
	})

	test('entering key lands after the previous keyed sibling, before trailing unreconciled elements', async () => {
		const container = new FakeElement('ul')
		const list = createList<string>(['a'], { keyConfig: 'item' })

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				() => {},
			)(),
		)

		const marker = new FakeElement('li')
		marker.setAttribute('data-unreconciled', '')
		container.appendChild(marker)

		list.add('b')
		await tick()

		expect(childKeys(container)).toEqual(['item0', 'item1', null])
		dispose()
	})
})

describe('reconcile — ownership', () => {
	test('disposing the enclosing scope disposes all per-item scopes', () => {
		const container = new FakeElement('ul')
		const list = createList<string>(['a', 'b', 'c'], { keyConfig: 'item' })
		const { disposed, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				bindItem,
			)(),
		)

		expect(disposed).toEqual([])
		dispose()
		expect(disposed.sort()).toEqual(['item0', 'item1', 'item2'])
	})

	test('per-item scopes survive structural re-runs (root-scoped, not effect-owned)', async () => {
		const container = new FakeElement('ul')
		const list = createList<string>(['a'], { keyConfig: 'item' })
		const { disposed, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				bindItem,
			)(),
		)

		list.add('b')
		await tick()
		list.add('c')
		await tick()

		expect(disposed).toEqual([])
		dispose()
	})
})

describe('reconcile — Collection source', () => {
	test('reconciles against a Collection driven by applyChanges', async () => {
		type Item = { id: string; label: string }
		let apply: (changes: { add?: Item[]; remove?: Item[] }) => void = () => {}
		const collection = createCollection<Item>(
			applyChanges => {
				apply = applyChanges
				return () => {}
			},
			{
				value: [{ id: 'x', label: 'X' }],
				keyConfig: item => item.id,
			},
		)
		const container = new FakeElement('ul')
		const { mounted, disposed, bindItem } = makeBindRecorder()

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				collection,
				bindItem,
			)(),
		)

		expect(childKeys(container)).toEqual(['x'])

		apply({ add: [{ id: 'y', label: 'Y' }] })
		await tick()
		expect(childKeys(container)).toEqual(['x', 'y'])
		expect(mounted.map(c => c.key)).toEqual(['x', 'y'])

		apply({ remove: [{ id: 'x', label: 'X' }] })
		await tick()
		expect(childKeys(container)).toEqual(['y'])
		expect(disposed).toEqual(['x'])
		dispose()
	})
})

// bindItem runs inside an ambient effect-descriptor collector, so watch()/on()/
// pass()/provideContexts()/run() can be called inside it directly. Collected
// descriptors activate against the per-item { root: true } scope, NOT the
// driving structural effect, so item-level watch(item, …) must not re-trigger
// structural work.
describe('reconcile — collector parity with each() (ADR 0017)', () => {
	const stubHost = () => ({}) as unknown as HTMLElement & ComponentProps

	test('a bare watch(item, …) inside bindItem reacts to item-value changes', async () => {
		type Item = { id: string; label: string }
		const container = new FakeElement('ul')
		const list = createList<Item>([{ id: 'x', label: 'X' }], {
			keyConfig: item => item.id,
		})
		const host = stubHost()
		const watch = makeWatch(host)

		const seen: string[] = []
		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				(_element, item) => {
					watch(item, ({ label }) => {
						seen.push(label)
					})
				},
			)(),
		)

		expect(seen).toEqual(['X'])

		list.replace('x', { id: 'x', label: 'X-updated' })
		await tick()

		expect(seen).toEqual(['X', 'X-updated'])
		dispose()
	})

	test('a MaybeCleanup returned from bindItem runs when the key leaves', async () => {
		const container = new FakeElement('ul')
		const list = createList<string>(['a', 'b'], { keyConfig: 'item' })
		const cleanedUp: string[] = []

		const dispose = createScope(() =>
			reconcile(
				container as unknown as Element,
				makeTemplate(),
				list,
				(_element, _item, key) => () => {
					cleanedUp.push(key)
				},
			)(),
		)

		expect(cleanedUp).toEqual([])

		list.remove('item0')
		await tick()

		expect(cleanedUp).toEqual(['item0'])
		dispose()
	})

	test('the driving structural effect does not depend on item signals', async () => {
		// Guards the { root: true } scope invariant: an item-value mutation
		// (not a keys change) must not re-run structural work.
		type Item = { id: string; label: string }
		const container = new FakeElement('ul')
		const list = createList<Item>(
			[
				{ id: 'x', label: 'X' },
				{ id: 'y', label: 'Y' },
			],
			{ keyConfig: item => item.id },
		)
		const mountCount = { value: 0 }
		const host = stubHost()
		const watch = makeWatch(host)

		const dispose = createScope(() =>
			reconcile(container as unknown as Element, makeTemplate(), list, () => {
				mountCount.value++
				// If the structural effect shared this dependency, every item
				// mutation would re-run structural work and re-mount items.
				watch(createState('sentinel'), () => {})
			})(),
		)
		const mountsAfterInitial = mountCount.value
		expect(mountsAfterInitial).toBe(2)

		list.replace('x', { id: 'x', label: 'X-updated' })
		await tick()

		expect(mountCount.value).toBe(mountsAfterInitial)
		dispose()
	})

	// The synchronous-only collector invariant (watch()/on()/pass() called after
	// an `await` inside bindItem throws NoActiveCollectorError) isn't retested
	// here: this file's beforeEach installs a file-level ambient collector so
	// reconcile() can be called outside a factory, which would mask the throw.
	// It's guarded at the component level in component.test.ts instead.
})
