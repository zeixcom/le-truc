/**
 * Drag-and-drop and keyboard reordering for `module-todo` (LT-111,
 * ADR 0046 s5 / LT-427). One shared client-only helper: every compiled
 * surface of the variant set (`.tsx` served, `.tsrx` twin) calls
 * `setupReorder()` from its setup, and the pointer/keyboard interaction
 * plus the live region live here instead of in module-scope `let`s of a
 * hand-written component. Because the call is a client-only setup side
 * effect to a client-known import, the statement stays out of the server
 * module entirely (LT-427).
 *
 * The per-item remove goes through the key in the item's own `onClick`
 * (`items.remove(k)`, ADR 0046 s4) — not through a host-delegated handler.
 * When the removed item was the selection, the next click on its remove
 * button clears the selection here, so the keyboard state never points at
 * a detached element.
 */
import { type MutableList, type MutableStore, query } from '@zeix/le-truc'

export type TodoItem = {
	id: string
	label: string
	createdAt: Date
	completed: boolean
}

const DRAG_THRESHOLD = 5
const REORDER_CLASS = 'reorder'
const REORDER_SELECTOR = `button.${REORDER_CLASS}`
const DRAGGING_CLASS = 'dragging'
const REMOVE_SELECTOR = 'basic-button.remove'

let idCounter = 0

/**
 * The `id` for a new todo item — unique per page (the counter is
 * module-global, so two `module-todo` instances on one page never collide).
 * Called from client-only handler positions (the add-item submit handler).
 */
export const nextTodoId = (): string => `todo${++idCounter}`

/**
 * Wire keyboard reordering (focus a reorder handle, then ArrowUp/ArrowDown
 * to move, Escape to deselect), drag-and-drop with a drop marker, the
 * selection announcements, and the live region. The list mutation goes
 * through the reactive List, so the container re-renders through
 * reconciliation; transient drag state is owned by the event handlers.
 */
export function setupReorder(
	host: HTMLElement,
	container: HTMLElement,
	list: MutableList<TodoItem, MutableStore<TodoItem>>,
	liveRegion: HTMLElement,
): void {
	const getItemText = (item: HTMLElement): string =>
		query(item, 'label.text, span')?.textContent?.trim() ?? 'item'

	const announce = (message: string) => {
		liveRegion.textContent = message
	}

	let selectedItem: HTMLElement | null = null

	function selectItem(item: HTMLElement | null) {
		if (item) {
			const items = Array.from(container.children)
			announce(
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
		announce(
			`${getItemText(item)} moved to position ${newIdx + 1} of ${list.length}.`,
		)
		query(item, REORDER_SELECTOR)?.focus()
	}

	let dragItem: HTMLElement | null = null
	let marker: HTMLElement | null = null
	let dragOffsetY = 0
	let pendingDragHandle: HTMLElement | null = null
	let pointerStartY = 0
	let pointerStartX = 0
	let suppressNextClick = false

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

	function startDrag(item: HTMLElement, rect: DOMRect) {
		dragItem = item
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

	function cleanUpDrag() {
		if (dragItem) {
			dragItem.style.cssText = ''
			dragItem.classList.remove(DRAGGING_CLASS)
			dragItem.removeAttribute('data-unreconciled')
		}
		marker?.remove()
		dragItem = null
		marker = null
	}

	host.addEventListener('click', event => {
		if (suppressNextClick) {
			suppressNextClick = false
			return
		}
		const target = event.target as HTMLElement
		const item = target.closest('[data-key]')
		if (!(item instanceof HTMLElement)) return

		if (target.closest(REMOVE_SELECTOR)) {
			// The item's own per-item listener removes through the key; the
			// selection never outlives its element.
			if (item === selectedItem) selectedItem = null
		} else if (target.closest(REORDER_SELECTOR)) {
			selectedItem = item
			selectItem(item)
		}
	})

	host.addEventListener('keydown', event => {
		// The selection never outlives its element: a remove clears it on the
		// way through (click), and a stale one reads as none.
		if (!selectedItem || !selectedItem.isConnected) return
		const target = event.target as HTMLElement
		if (!target.classList.contains(REORDER_CLASS)) return
		if (event.key === 'Escape') {
			selectedItem = null
			return
		}
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
		event.preventDefault()
		if (event.key === 'ArrowUp') moveItem(selectedItem, -1)
		else moveItem(selectedItem, 1)
	})

	// pointermove/pointerup/pointercancel are only attached while a drag
	// might be in progress, mirroring form-colorgraph.ts — keeps them off
	// the debugger's always-on radar.
	host.addEventListener('pointerdown', event => {
		const handle = (event.target as HTMLElement).closest(REORDER_SELECTOR)
		if (!(handle instanceof HTMLElement)) return
		const item = handle.closest('[data-key]')
		if (!(item instanceof HTMLElement)) return
		event.preventDefault()
		pendingDragHandle = handle
		pointerStartY = event.clientY
		pointerStartX = event.clientX
		suppressNextClick = false
		handle.setPointerCapture(event.pointerId)
		handle.focus()

		const handleMove = (e: PointerEvent) => {
			if (!pendingDragHandle) return
			const dy = Math.abs(e.clientY - pointerStartY)
			const dx = Math.abs(e.clientX - pointerStartX)

			if (!dragItem && (dy > DRAG_THRESHOLD || dx > DRAG_THRESHOLD)) {
				const dragged = pendingDragHandle.closest('[data-key]')
				if (!(dragged instanceof HTMLElement)) return
				startDrag(dragged, dragged.getBoundingClientRect())
			}

			if (dragItem) {
				dragItem.style.top = `${e.clientY - dragOffsetY}px`
				updateMarkerPosition(e.clientY)
			}
		}

		const handleUp = () => {
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
				cleanUpDrag()
				suppressNextClick = true
				applyOrder(keys)
			}
			pendingDragHandle = null
			cleanup()
		}

		const handleCancel = () => {
			cleanUpDrag()
			pendingDragHandle = null
			suppressNextClick = false
			cleanup()
		}

		function cleanup() {
			host.removeEventListener('pointermove', handleMove)
			host.removeEventListener('pointerup', handleUp)
			host.removeEventListener('pointercancel', handleCancel)
		}

		host.addEventListener('pointermove', handleMove, { passive: true })
		host.addEventListener('pointerup', handleUp)
		host.addEventListener('pointercancel', handleCancel)
	})
}
