import { bindText, createState, defineComponent } from '../../..'

export type ModuleListProps = {
	keys: string[]
}

declare global {
	interface HTMLElementTagNameMap {
		'module-list': HTMLElement & ModuleListProps
	}
}

const DRAG_THRESHOLD = 5
const REORDER_CLASS = 'reorder'
const REORDER_SELECTOR = `.${REORDER_CLASS}`
const DRAGGING_CLASS = 'dragging'

export default defineComponent<ModuleListProps>(
	'module-list',
	({ expose, first, host, on, watch }) => {
		const container = first(
			'[data-container]',
			'Add a container element for items.',
		)
		const template = first('template', 'Add a template element for items.')
		const liveRegion = first(
			'[role="status"]',
			'Add a live region for status messages.',
		)

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
			return item.querySelector('span')?.textContent?.trim() ?? 'item'
		}

		function selectItem(item: HTMLElement | null) {
			selectedItem = item
			if (item) {
				const items = Array.from(container.children)
				status.set(
					`${getItemText(item)} selected, position ${items.indexOf(item) + 1} of ${items.length}. ` +
						`Press Up or Down arrow to move, Escape to cancel.`,
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
				`${getItemText(item)} moved to position ${newPos} of ${items.length}.`,
			)
			item.querySelector<HTMLElement>(REORDER_SELECTOR)?.focus()
			fireReorderEvent()
		}

		function updateReorderButtons(count: number) {
			const disabled = count <= 1
			for (const btn of container.querySelectorAll<HTMLButtonElement>(
				REORDER_SELECTOR,
			)) {
				btn.disabled = disabled
			}
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

		function fireReorderEvent() {
			const keys = Array.from(container.children)
				.filter(el => el instanceof HTMLElement && el.dataset.key)
				.map(el => (el as HTMLElement).dataset.key!)
			host.dispatchEvent(
				new CustomEvent('item-reorder', { bubbles: true, detail: { keys } }),
			)
		}

		expose({ keys: [] as string[] })

		return [
			watch('keys', keys => {
				// Build map of current <li data-key> elements
				const current = new Map<string, HTMLElement>()
				for (const child of container.children) {
					const el = child as HTMLElement
					if (el.dataset.key) current.set(el.dataset.key, el)
				}

				const keysSet = new Set(keys)

				// Remove orphaned elements
				for (const [key, el] of current) {
					if (!keysSet.has(key)) el.remove()
				}

				// Insert and reorder
				for (let i = 0; i < keys.length; i++) {
					const key = keys[i]!
					let el = current.get(key)
					if (!el) {
						const fragment = template.content.cloneNode(
							true,
						) as DocumentFragment
						el = fragment.firstElementChild as HTMLElement
						el.dataset.key = key
					}
					const currentAtI = container.children[i]
					if (currentAtI !== el) container.insertBefore(el, currentAtI ?? null)
				}

				updateReorderButtons(keys.length)
			}),

			on(host, 'click', e => {
				if (suppressNextClick) {
					suppressNextClick = false
					return
				}
				const target = e.target as HTMLElement
				const item = target.closest('[data-key]')
				if (!(item instanceof HTMLElement)) return

				if (
					target.closest('basic-button.remove') ||
					target.closest('basic-button.delete')
				) {
					e.stopPropagation()
					if (item === selectedItem) selectItem(null)
					host.dispatchEvent(
						new CustomEvent('item-delete', {
							bubbles: true,
							detail: { key: item.dataset.key },
						}),
					)
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
					marker.style.height = `${rect.height - 4}px` // subtract 4px to account for border padding
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
					fireReorderEvent()
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

			watch(status, bindText(liveRegion)),
		]
	},
)
