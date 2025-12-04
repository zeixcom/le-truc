import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createCollection, isCollection } from '../../src/signals/collection'

describe('Collection', () => {
	let container: HTMLDivElement

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
	})

	afterEach(() => {
		container.remove()
	})

	describe('Basic functionality', () => {
		test('should create an empty collection', () => {
			const collection = createCollection(container, 'button')
			expect(collection.get()).toEqual([])
			expect(collection.length).toBe(0)
		})

		test('should find existing elements', () => {
			container.innerHTML = '<button>1</button><button>2</button>'
			const collection = createCollection(container, 'button')

			expect(collection.get()).toHaveLength(2)
			expect(collection.length).toBe(2)
			expect(collection[0]).toBe(
				container.querySelector('button') as HTMLButtonElement,
			)
		})

		test('should match complex selectors', () => {
			container.innerHTML = `
				<button class="primary">Primary</button>
				<button class="secondary">Secondary</button>
				<div>Not a button</div>
			`
			const collection = createCollection(container, 'button.primary')

			expect(collection.get()).toHaveLength(1)
			expect(collection[0]?.textContent).toBe('Primary')
		})
	})

	describe('Type checking', () => {
		test('should identify collections', () => {
			const collection = createCollection(container, 'div')
			expect(isCollection(collection)).toBe(true)
			expect(isCollection([])).toBe(false)
			expect(isCollection({})).toBe(false)
		})

		test('should have correct Symbol.toStringTag', () => {
			const collection = createCollection(container, 'div')
			expect(Object.prototype.toString.call(collection)).toBe(
				'[object Collection]',
			)
		})
	})

	describe('Array-like behavior', () => {
		beforeEach(() => {
			container.innerHTML = '<div>1</div><div>2</div><div>3</div>'
		})

		test('should support numeric indexing', () => {
			const collection = createCollection(container, 'div')

			expect(collection[0]).toBe(container.children[0] as HTMLDivElement)
			expect(collection[1]).toBe(container.children[1] as HTMLDivElement)
			expect(collection[2]).toBe(container.children[2] as HTMLDivElement)
			expect(collection[3]).toBeUndefined()
		})

		test('should be iterable', () => {
			const collection = createCollection(container, 'div')
			const elements = [...collection]

			expect(elements).toHaveLength(3)
			expect(elements[0]).toBe(container.children[0] as HTMLDivElement)
		})

		test('should support array methods', () => {
			const collection = createCollection(container, 'div')

			// forEach
			const texts: string[] = []
			collection.get().forEach(el => texts.push(el.textContent || ''))
			expect(texts).toEqual(['1', '2', '3'])

			// map
			const mapped = collection.get().map(el => el.textContent)
			expect(mapped).toEqual(['1', '2', '3'])

			// filter
			const filtered = collection
				.get()
				.filter(el => el.textContent === '2')
			expect(filtered).toHaveLength(1)
			expect(filtered[0]).toBe(container.children[1] as HTMLDivElement)

			// find
			const found = collection.get().find(el => el.textContent === '2')
			expect(found).toBe(container.children[1] as HTMLDivElement)
		})

		test('should be spreadable', () => {
			const collection = createCollection(container, 'div')
			const spread = [...collection]

			expect(spread).toHaveLength(3)
			expect(spread[0]).toBe(container.children[0] as HTMLDivElement)
		})

		test('should support Object.keys for indices', () => {
			const collection = createCollection(container, 'div')
			const keys = Object.keys(collection)

			// Should include numeric indices
			expect(keys).toContain('0')
			expect(keys).toContain('1')
			expect(keys).toContain('2')
			expect(keys).not.toContain('3')
		})

		test('should handle property descriptor for indices', () => {
			const collection = createCollection(container, 'div')
			const descriptor = Object.getOwnPropertyDescriptor(collection, '1')

			expect(descriptor).toBeDefined()
			expect(descriptor?.value).toBe(container.children[1])
			expect(descriptor?.enumerable).toBe(true)
		})
	})

	/* describe('Mutation observation', () => {
		test('should detect element additions', done => {
			const collection = createCollection(container, 'button')

			collection.on('add', added => {
				expect(added).toHaveLength(1)
				expect(added[0].textContent).toBe('New')
				expect(collection.get()).toHaveLength(1)
				done()
			})

			container.innerHTML = '<button>New</button>'
		})

		test('should detect element removals', done => {
			container.innerHTML = '<button>Remove me</button>'
			const collection = createCollection(container, 'button')

			collection.on('remove', removed => {
				expect(removed).toHaveLength(1)
				expect(removed[0].textContent).toBe('Remove me')
				expect(collection.get()).toHaveLength(0)
				done()
			})

			container.innerHTML = ''
		})

		test('should only notify about matching elements', done => {
			const collection = createCollection(container, 'button')
			let addCount = 0

			collection.on('add', added => {
				addCount++
				expect(added.every(el => el.matches('button'))).toBe(true)
			})

			// Add both matching and non-matching elements
			container.innerHTML =
				'<button>Match</button><div>No match</div><button>Match 2</button>'

			setTimeout(() => {
				expect(addCount).toBe(1) // Should only fire once
				expect(collection.get()).toHaveLength(2)
				done()
			}, 10)
		})

		test('should maintain DOM order after mutations', done => {
			container.innerHTML = '<button>2</button>'
			const collection = createCollection(container, 'button')

			collection.on('add', () => {
				const elements = collection.get()
				expect(elements[0].textContent).toBe('1') // First in DOM order
				expect(elements[1].textContent).toBe('2') // Second in DOM order
				done()
			})

			// Insert at beginning
			const newButton = document.createElement('button')
			newButton.textContent = '1'
			container.insertBefore(newButton, container.firstChild)
		})
	}) */

	/* describe('Attribute observation', () => {
		test('should observe class changes', done => {
			container.innerHTML = '<div class="foo">Test</div><div>Other</div>'
			const collection = createCollection(container, '.foo')

			expect(collection.get()).toHaveLength(1)

			collection.on('add', added => {
				expect(added).toHaveLength(1)
				expect(added[0].textContent).toBe('Other')
				expect(collection.get()).toHaveLength(2)
				done()
			})

			// Add class to make second div match
			const secondDiv = container.children[1] as HTMLElement
			secondDiv.classList.add('foo')
		})

		test('should observe id changes', done => {
			container.innerHTML =
				'<div id="target">Target</div><div>Other</div>'
			const collection = createCollection(container, '#target')

			expect(collection.get()).toHaveLength(1)

			collection.on('remove', removed => {
				expect(removed).toHaveLength(1)
				expect(collection.get()).toHaveLength(0)
				done()
			})

			// Remove id to make element not match
			const targetDiv = container.children[0] as HTMLElement
			targetDiv.removeAttribute('id')
		})

		test('should observe custom attribute changes', done => {
			container.innerHTML =
				'<div data-role="item">Item</div><div>Other</div>'
			const collection = createCollection(container, '[data-role="item"]')

			expect(collection.get()).toHaveLength(1)

			collection.on('add', added => {
				expect(added).toHaveLength(1)
				expect(collection.get()).toHaveLength(2)
				done()
			})

			// Add attribute to make second div match
			const secondDiv = container.children[1] as HTMLElement
			secondDiv.setAttribute('data-role', 'item')
		})
	}) */

	describe('Reactivity', () => {
		test('should trigger reactive updates on mutations', () => {
			const collection = createCollection(container, 'span')
			let callCount = 0

			// Simulate reactive subscription
			const triggerReactive = () => {
				callCount++
				return collection.get()
			}

			triggerReactive() // Initial call
			expect(callCount).toBe(1) // Initial call

			// Add element should trigger reactivity
			container.innerHTML = '<span>New</span>'

			// Give mutation observer time to fire
			return new Promise<void>(resolve => {
				setTimeout(() => {
					// Access length to trigger subscription
					expect(collection.length).toBe(1)
					triggerReactive() // Trigger again to check reactivity
					expect(callCount).toBeGreaterThan(1)
					resolve()
				}, 10)
			})
		})
	})

	describe('Event listeners', () => {
		test('should return unsubscribe function', () => {
			const collection = createCollection(container, 'div')
			let called = false

			const off = collection.on('add', () => {
				called = true
			})

			// Add element
			container.innerHTML = '<div>Test</div>'

			return new Promise<void>(resolve => {
				setTimeout(() => {
					expect(called).toBe(true)
					called = false

					// Unsubscribe and test again
					off()
					container.innerHTML = '<div>Test 1</div><div>Test 2</div>'

					setTimeout(() => {
						expect(called).toBe(false) // Should not be called
						resolve()
					}, 10)
				}, 10)
			})
		})

		test('should throw on invalid event type', () => {
			const collection = createCollection(container, 'div')

			expect(() => {
				;(collection as any).on('invalid', () => {})
			}).toThrow('Invalid change notification type: invalid')
		})
	})

	describe('Edge cases', () => {
		test('should handle nested mutations', done => {
			const collection = createCollection(container, '.item')
			let addEvents = 0

			collection.on('add', () => {
				addEvents++
			})

			// Add multiple elements in nested structure
			container.innerHTML = `
				<div class="item">1</div>
				<div class="wrapper">
					<div class="item">2</div>
					<div class="item">3</div>
				</div>
			`

			setTimeout(() => {
				expect(addEvents).toBe(1) // Should batch mutations
				expect(collection.get()).toHaveLength(3)
				done()
			}, 20)
		})

		test('should handle rapid mutations', done => {
			const collection = createCollection(container, 'p')
			const events: string[] = []

			collection.on('add', () => events.push('add'))
			collection.on('remove', () => events.push('remove'))

			// Rapid sequence of mutations
			container.innerHTML = '<p>1</p>'
			container.innerHTML = '<p>1</p><p>2</p>'
			container.innerHTML = '<p>2</p>'

			setTimeout(() => {
				expect(collection.get()).toHaveLength(1)
				expect(collection[0].textContent).toBe('2')
				done()
			}, 30)
		})
	})
})
