import {
	bindProperty,
	bindState,
	bindText,
	createList,
	createMemo,
	createState,
	createStore,
	defineComponent,
	each,
	reconcile,
	type Store,
} from '../../..'

export type TodoItem = {
	id: string
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

let idCounter = 0

/**
 * A full-featured todo list with add, remove, complete, filter, and drag-and-drop reordering.
 * Use it as a reference example of a complete Le Truc application — keyboard accessible
 * controls and ARIA labelling should be considered when adapting it for production use.
 * Exposes the active filter as custom states (`:state(filter-active)`, `:state(filter-completed)`)
 * for CSS-based item visibility, so filter state cannot be spoofed by setting an attribute.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-todo} Interactive preview and usage examples
 **/
export default defineComponent(
	'module-todo',
	({ all, first, host, internals, on, pass, watch }) => {
		const container = first(
			'[data-container]',
			'Add a container element for items.',
		)
		const liveRegion = first(
			'[role="status"]',
			'Add a live region for status messages.',
		)

		const list = createList<TodoItem, Store<TodoItem>>([], {
			keyConfig: item => item.id,
			createItem: createStore,
		})

		const completedCount = createMemo(
			() => list.get().filter(item => item.completed).length,
		)
		const activeCount = createMemo(() => list.length - completedCount.get())
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
					`${getItemText(item)} selected, position ${items.indexOf(item) + 1} of ${list.length}. ` +
						`Press Up or Down arrow to move.`,
				)
			}
		}

		function moveItem(item: HTMLElement, direction: -1 | 1) {
			const key = item.dataset.key
			if (!key) return
			const index = list.indexOfKey(key)
			const newIdx = index + direction
			if (index < 0 || newIdx < 0 || newIdx >= list.length) return
			// Mutate the list — reconcile() moves the element synchronously,
			// so position and focus can be read right after.
			list.update(prev => {
				const next = [...prev]
				const [moved] = next.splice(index, 1)
				next.splice(newIdx, 0, moved!)
				return next
			})
			status.set(
				`${getItemText(item)} moved to position ${newIdx + 1} of ${list.length}.`,
			)
			item.querySelector<HTMLElement>(REORDER_SELECTOR)?.focus()
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

		function applyOrder(keys: string[]) {
			list.update(prev => {
				const byKey = new Map(prev.map((item, i) => [list.keyAt(i), item]))
				return keys.map(k => byKey.get(k)).filter(Boolean) as TodoItem[]
			})
		}

		const textbox = first(
			'form-textbox',
			'Add <form-textbox> component to enter a new todo item.',
		)
		const submit = first(
			'basic-button.submit',
			'Add <basic-button.submit> component to submit the form.',
		)
		pass(submit, { disabled: () => !textbox.length })

		const count = first(
			'basic-pluralize',
			'Add <basic-pluralize> component to display the number of todo items.',
		)
		pass(count, { count: () => activeCount.get() })

		const clearCompleted = first(
			'basic-button.clear-completed',
			'Add <basic-button.clear-completed> component to clear completed todo items.',
		)
		pass(clearCompleted, {
			disabled: () => !completedCount.get(),
			badge: () => (completedCount.get() ? String(completedCount.get()) : ''),
		})
		on(clearCompleted, 'click', () => {
			for (let i = list.length - 1; i >= 0; i--) {
				const key = list.keyAt(i)
				if (key && list.byKey(key)?.completed.get()) list.remove(key)
			}
		})

		const reorderButtons = all(REORDER_SELECTOR)
		each(reorderButtons, button => {
			watch(() => list.length === 1, bindProperty(button, 'disabled'))
		})

		const checkboxComponents = all('form-checkbox')
		each(checkboxComponents, checkbox => {
			const key = checkbox.closest<HTMLElement>('[data-key]')?.dataset.key
			if (!key || !checkbox.isConnected) return
			pass(checkbox, {
				checked: {
					get: () => list.byKey(key)?.completed.get() ?? false,
					set: (checked: boolean) => list.byKey(key)?.completed.set(checked),
				},
			})
		})

		const editComponents = all('form-inplace-edit')
		each(editComponents, editEl => {
			const key = editEl.closest<HTMLElement>('[data-key]')?.dataset.key
			if (!key || !editEl.isConnected) return
			pass(editEl, {
				value: {
					get: () => list.byKey(key)?.label.get() ?? '',
					set: (value: string) => list.byKey(key)?.label.set(value),
				},
			})
		})

		// Sync the container's children to the list. bindItem fills the cloned
		// content — server-adopted items already carry ids and text, so the
		// fill is naturally idempotent (no <slot> left to replace).
		const template = first('template', 'Add a template element for items.')
		reconcile(container, template, list, (element, item, key) => {
			const id = `${key}-checkbox`
			const checkbox = element.querySelector('input')
			if (checkbox) checkbox.id = id
			const label = element.querySelector('label')
			if (label) label.htmlFor = id
			element
				.querySelector('slot')
				?.replaceWith(document.createTextNode(item.label.get()))
		})

		const form = first('form', 'Add a form element to enter a new todo item.')
		on(form, 'submit', e => {
			e.preventDefault()
			const label = textbox.value.trim()
			if (!label) return
			list.add({
				id: `todo${++idCounter}`,
				label,
				createdAt: new Date(),
				completed: false,
			})
			textbox.clear()
		})

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
				const key = item.dataset.key
				if (key) list.remove(key)
			} else if (target.closest(REORDER_SELECTOR)) {
				selectItem(item)
			}
		})

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
		})

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
		})

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

				// Transient drag state is owned by the event handlers:
				// data-unreconciled protects the marker and the dragged item
				// from a reconcile re-run mid-drag (e.g. a concurrent edit).
				marker = document.createElement('li')
				marker.className = 'drop-marker'
				marker.setAttribute('data-unreconciled', '')
				marker.style.height = `${rect.height - 4}px`
				container.insertBefore(marker, item)

				item.setAttribute('data-unreconciled', '')
				item.style.top = `${rect.top}px`
				item.style.left = `${rect.left}px`
				item.style.width = `${rect.width}px`
				item.classList.add(DRAGGING_CLASS)
			}

			if (dragItem) {
				dragItem.style.top = `${e.clientY - dragOffsetY}px`
				updateMarkerPosition(e.clientY)
			}
		})

		on(host, 'pointerup', () => {
			if (dragItem && marker) {
				// Committed order: keyed children in DOM order, with the dragged
				// key at the marker's position. Read before cleaning up.
				const keys: string[] = []
				for (const child of container.children) {
					if (child === marker) {
						if (dragItem.dataset.key) keys.push(dragItem.dataset.key)
					} else if (
						child instanceof HTMLElement &&
						child.dataset.key &&
						child !== dragItem
					) {
						keys.push(child.dataset.key)
					}
				}
				// Clean up transient state and strip the pin before committing —
				// reconcile() is the sole writer to structural children.
				marker.remove()
				dragItem.style.cssText = ''
				dragItem.classList.remove(DRAGGING_CLASS)
				dragItem.removeAttribute('data-unreconciled')
				dragItem = null
				marker = null
				suppressNextClick = true
				applyOrder(keys)
			}
			pendingDragHandle = null
		})

		on(host, 'pointercancel', () => {
			if (dragItem && marker) {
				marker.remove()
				dragItem.style.cssText = ''
				dragItem.classList.remove(DRAGGING_CLASS)
				dragItem.removeAttribute('data-unreconciled')
				dragItem = null
				marker = null
			}
			pendingDragHandle = null
			suppressNextClick = false
		})

		const filter = first(
			'form-radiogroup',
			'Add <form-radiogroup> component to filter todo items.',
		)
		watch(
			() => (filter.value || 'all') === 'active',
			bindState(internals, 'filter-active'),
		)
		watch(
			() => (filter.value || 'all') === 'completed',
			bindState(internals, 'filter-completed'),
		)

		watch(status, bindText(liveRegion))
	},
)
