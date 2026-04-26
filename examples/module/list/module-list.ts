import {
	asInteger,
	bindText,
	createState,
	defineComponent,
	defineMethod,
	MissingElementError,
} from '../../..'

export type ModuleListProps = {
	max: number
	add: (process?: (item: HTMLElement) => void) => void
	delete: (key: string) => void
}

declare global {
	interface HTMLElementTagNameMap {
		'module-list': HTMLElement & ModuleListProps
	}
}

const MAX_ITEMS = 1000
const DRAG_THRESHOLD = 5
const REORDER_CLASS = 'reorder'
const REORDER_SELECTOR = `.${REORDER_CLASS}`
const DRAGGING_CLASS = 'dragging'

export default defineComponent<ModuleListProps>(
	'module-list',
	({ expose, first, host, on, pass, watch }) => {
		const container = first(
			'[data-container]',
			'Add a container element for items.',
		)
		const template = first('template', 'Add a template element for items.')
		const form = first('form')
		const textbox = first('form-textbox')
		const add = first('basic-button.add')
		const liveRegion = first(
			'[role="status"]',
			'Add a live region for status messages.',
		)

		const status = createState(liveRegion.textContent)

		let addKey = 0
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
					`${getItemText(item)} selected, position ${items.indexOf(item) + 1} of ${items.length}. `
						+ `Press Up or Down arrow to move, Escape to cancel.`,
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

		expose({
			max: asInteger(MAX_ITEMS),
			add: defineMethod((process?: (item: HTMLElement) => void) => {
				const item = (template.content.cloneNode(true) as DocumentFragment)
					.firstElementChild
				if (item && item instanceof HTMLElement) {
					item.dataset.key = String(addKey++)
					if (process) process(item)
					container.append(item)
				} else {
					throw new MissingElementError(
						host,
						'*',
						'Template does not contain an item element.',
					)
				}
			}),
			delete: defineMethod((key: string) => {
				const item = container.querySelector(`[data-key="${key}"]`)
				if (item) {
					if (item === selectedItem) selectItem(null)
					item.remove()
				}
			}),
		})

		return [
			pass(add, {
				disabled: () =>
					(textbox && !textbox.length) || container.children.length >= host.max,
			}),

			on(form, 'submit', e => {
				e.preventDefault()
				const content = textbox?.value
				if (content) {
					host.add(item => {
						item.querySelector('slot')?.replaceWith(content)
					})
					textbox.clear()
				}
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
					item.remove()
				} else if (target.closest('basic-button.edit')) {
					e.stopPropagation()
				} else if (target.closest(REORDER_SELECTOR)) {
					selectItem(item)
				}
			}),

			on(host, 'keydown', e => {
				if (!selectedItem) return
				const target = e.target as HTMLElement
				if (!target.classList.contains(REORDER_CLASS)) return
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

			on(host, 'pointerup', e => {
				if (dragItem && marker) {
					marker.replaceWith(dragItem)
					dragItem.style.cssText = ''
					dragItem.classList.remove(DRAGGING_CLASS)
					dragItem = null
					marker = null
					suppressNextClick = true
				}
				pendingDragHandle = null
			}),

			on(host, 'pointercancel', e => {
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
