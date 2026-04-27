import {
	bindAttribute,
	bindProperty,
	bindText,
	createList,
	createMemo,
	createState,
	createStore,
	defineComponent,
	each,
	type Store,
	type List,
} from '../../..'

export type TodoItem = {
	label: string
	createdAt: Date
	completed: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'module-todo': HTMLElement
	}
}

const DRAG_THRESHOLD = 5
const REORDER_CLASS = 'reorder'
const REORDER_SELECTOR = `button.${REORDER_CLASS}`
const DRAGGING_CLASS = 'dragging'

export default defineComponent(
	'module-todo',
	({ all, first, host, on, pass, watch }) => {
		const form = first('form', 'Add a form element to enter a new todo item.')
		const textbox = first(
			'form-textbox',
			'Add <form-textbox> component to enter a new todo item.',
		)
		const submit = first(
			'basic-button.submit',
			'Add <basic-button.submit> component to submit the form.',
		)
		const container = first(
			'[data-container]',
			'Add a container element for items.',
		)
		const template = first('template', 'Add a template element for items.')
		const liveRegion = first(
			'[role="status"]',
			'Add a live region for status messages.',
		)
		const count = first(
			'basic-pluralize',
			'Add <basic-pluralize> component to display the number of todo items.',
		)
		const filter = first(
			'form-radiogroup',
			'Add <form-radiogroup> component to filter todo items.',
		)
		const clearCompleted = first(
			'basic-button.clear-completed',
			'Add <basic-button.clear-completed> component to clear completed todo items.',
		)
		const reorderButtons = all(REORDER_SELECTOR)
		const checkboxComponents = all('form-checkbox')
		const editComponents = all('form-inplace-edit')

		const list = createList<TodoItem>([], {
			keyConfig: 'todo',
			createItem: v => createStore(v),
		}) as unknown as Omit<List<TodoItem>, 'byKey' | typeof Symbol.iterator> & {
			byKey(key: string): Store<TodoItem> | undefined
			[Symbol.iterator](): IterableIterator<Store<TodoItem>>
		}

		const activeCount = createMemo(() => {
			list.keys()
			let count = 0
			for (const item of list) {
				if (!item.completed.get()) count++
			}
			return count
		})
		const completedCount = createMemo(() => {
			list.keys()
			let count = 0
			for (const item of list) {
				if (item.completed.get()) count++
			}
			return count
		})
		const status = createState(liveRegion.textContent)

		let selectedItem: HTMLElement | null = null
		let dragItem: HTMLElement | null = null
		let marker: HTMLElement | null = null
		let dragOffsetY = 0
		let pendingDragHandle: HTMLElement | null = null
		let pointerStartY = 0
		let pointerStartX = 0
		let suppressNextClick = false

		function getItemText(item: HTMLElement): string {
			return (
				item.querySelector('label.text, span')?.textContent?.trim() ?? 'item'
			)
		}

		function selectItem(item: HTMLElement | null) {
			selectedItem = item
			if (item) {
				const items = Array.from(container.children)
				status.set(
					`${getItemText(item)} selected, position ${items.indexOf(item) + 1} of ${list.length}. `
						+ `Press Up or Down arrow to move.`,
				)
			}
		}

		function moveItem(item: HTMLElement, direction: -1 | 1) {
			const items = Array.from(container.children)
			const idx = items.indexOf(item)
			const newIdx = idx + direction
			if (newIdx < 0 || newIdx >= items.length) return
			const sibling = items[newIdx]!
			if (direction === 1) sibling.after(item)
			else sibling.before(item)
			const newPos = Array.from(container.children).indexOf(item) + 1
			status.set(
				`${getItemText(item)} moved to position ${newPos} of ${list.length}.`,
			)
			item.querySelector<HTMLElement>(REORDER_SELECTOR)?.focus()
			reorderList()
		}

		function updateMarkerPosition(clientY: number) {
			if (!marker || !dragItem) return
			const items = Array.from(container.children).filter(
				c => c !== marker && c !== dragItem,
			) as HTMLElement[]
			let insertBefore: Element | null = null
			for (const child of items) {
				const rect = child.getBoundingClientRect()
				if (clientY < rect.top + rect.height / 2) {
					insertBefore = child
					break
				}
			}
			if (insertBefore) container.insertBefore(marker, insertBefore)
			else container.appendChild(marker)
		}

		function reorderList() {
			const keys = Array.from(container.children)
				.filter(el => el instanceof HTMLElement && el.dataset.key)
				.map(el => (el as HTMLElement).dataset.key!)
			list.update(prev => {
				const byKey = new Map(prev.map((item, i) => [list.keyAt(i)!, item]))
				return keys.map(k => byKey.get(k)!).filter(Boolean) as TodoItem[]
			})
		}

		return [
			pass(submit, { disabled: () => !textbox.length }),
			pass(count, { count: () => activeCount.get() }),
			pass(clearCompleted, {
				disabled: () => !completedCount.get(),
				badge: () => (completedCount.get() ? String(completedCount.get()) : ''),
			}),

			each(reorderButtons, button => {
				return watch(() => list.length === 1, bindProperty(button, 'disabled'))
			}),

			each(checkboxComponents, checkbox => {
				const key = checkbox.closest<HTMLElement>('[data-key]')?.dataset.key
				if (!key) return
				const item = list.byKey(key)
				if (!item || !checkbox.isConnected) return
				return pass(checkbox, {
					checked: {
						get: () => item.completed.get(),
						set: (checked: boolean) => item.completed.set(checked),
					},
				})
			}),

			each(editComponents, editEl => {
				const key = editEl.closest<HTMLElement>('[data-key]')?.dataset.key
				if (!key) return
				const item = list.byKey(key)
				if (!item || !editEl.isConnected) return
				return pass(editEl, {
					value: {
						get: () => item.label.get(),
						set: (value: string) => item.label.set(value),
					},
				})
			}),

			watch(
				() => Array.from(list.keys()),
				() => {
					const keys = Array.from(list.keys())
					const current = new Map<string, HTMLElement>()
					for (const child of container.children) {
						const el = child as HTMLElement
						if (el.dataset.key) current.set(el.dataset.key, el)
					}

					const keysSet = new Set(keys)

					for (const [key, el] of current) {
						if (!keysSet.has(key)) el.remove()
					}

					for (let i = 0; i < keys.length; i++) {
						const key = keys[i]!
						let el = current.get(key)
						if (!el) {
							const fragment = template.content.cloneNode(
								true,
							) as DocumentFragment
							el = fragment.firstElementChild as HTMLElement
							el.dataset.key = key
							const id = `${key}-checkbox`
							const checkbox = el.querySelector('input')
							if (checkbox) checkbox.id = id
							const label = el.querySelector('label')
							if (label) label.htmlFor = id
							const text = el.querySelector('slot')
							if (text)
								text.replaceWith(
									document.createTextNode(list.byKey(key)?.label.get() ?? ''),
								)
						}
						const currentAtI = container.children[i]
						if (currentAtI !== el)
							container.insertBefore(el, currentAtI ?? null)
					}
				},
			),

			on(form, 'submit', e => {
				e.preventDefault()
				const label = textbox.value.trim()
				if (!label) return
				list.add({ label, createdAt: new Date(), completed: false })
				textbox.clear()
			}),

			on(host, 'click', e => {
				if (suppressNextClick) {
					suppressNextClick = false
					return
				}
				const target = e.target as HTMLElement
				const item = target.closest('[data-key]')
				if (!(item instanceof HTMLElement)) return

				if (target.closest('basic-button.remove')) {
					e.stopPropagation()
					if (item === selectedItem) selectItem(null)
					list.remove(item.dataset.key!)
				} else if (target.closest(REORDER_SELECTOR)) {
					selectItem(item)
				}
			}),

			on(host, 'keydown', e => {
				if (!selectedItem) return
				const target = e.target as HTMLElement
				if (!target.classList.contains(REORDER_CLASS)) return
				if (e.key === 'Escape') {
					selectItem(null)
					return
				}
				if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
				e.preventDefault()
				if (e.key === 'ArrowUp') moveItem(selectedItem, -1)
				else moveItem(selectedItem, 1)
			}),

			on(host, 'pointerdown', e => {
				const handle = (e.target as HTMLElement).closest(REORDER_SELECTOR)
				if (!(handle instanceof HTMLElement)) return
				const item = handle.closest('[data-key]')
				if (!(item instanceof HTMLElement)) return
				e.preventDefault()
				pendingDragHandle = handle
				pointerStartY = e.clientY
				pointerStartX = e.clientX
				suppressNextClick = false
				handle.setPointerCapture(e.pointerId)
				handle.focus()
			}),

			on(host, 'pointermove', e => {
				if (!pendingDragHandle) return
				const dy = Math.abs(e.clientY - pointerStartY)
				const dx = Math.abs(e.clientX - pointerStartX)

				if (!dragItem && (dy > DRAG_THRESHOLD || dx > DRAG_THRESHOLD)) {
					const item = pendingDragHandle.closest('[data-key]')
					if (!(item instanceof HTMLElement)) return

					dragItem = item
					const rect = item.getBoundingClientRect()
					dragOffsetY = pointerStartY - rect.top

					marker = document.createElement('li')
					marker.className = 'drop-marker'
					marker.style.height = `${rect.height - 4}px`
					container.insertBefore(marker, item)

					item.style.top = `${rect.top}px`
					item.style.left = `${rect.left}px`
					item.style.width = `${rect.width}px`
					item.classList.add(DRAGGING_CLASS)
				}

				if (dragItem) {
					dragItem.style.top = `${e.clientY - dragOffsetY}px`
					updateMarkerPosition(e.clientY)
				}
			}),

			on(host, 'pointerup', () => {
				if (dragItem && marker) {
					marker.replaceWith(dragItem)
					dragItem.style.cssText = ''
					dragItem.classList.remove(DRAGGING_CLASS)
					dragItem = null
					marker = null
					suppressNextClick = true
					reorderList()
				}
				pendingDragHandle = null
			}),

			on(host, 'pointercancel', () => {
				if (dragItem && marker) {
					marker.remove()
					dragItem.style.cssText = ''
					dragItem.classList.remove(DRAGGING_CLASS)
					dragItem = null
					marker = null
				}
				pendingDragHandle = null
				suppressNextClick = false
			}),

			on(clearCompleted, 'click', () => {
				for (let i = list.length - 1; i >= 0; i--) {
					const key = list.keyAt(i)
					if (key && list.byKey(key)?.completed.get()) list.remove(key)
				}
			}),

			watch(() => filter.value || 'all', bindAttribute(host, 'filter')),
			watch(status, bindText(liveRegion)),
		]
	},
)
