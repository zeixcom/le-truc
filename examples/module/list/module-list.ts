import {
	asInteger,
	defineComponent,
	defineMethod,
	MissingElementError,
} from '../../..'

export type ModuleListProps = {
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

export default defineComponent<ModuleListProps>(
	'module-list',
	({ expose, first, host, on, pass }) => {
		const container = first(
			'[data-container]',
			'Add a container element for items.',
		)
		const template = first('template', 'Add a template element for items.')
		const form = first('form')
		const textbox = first('form-textbox')
		const add = first('basic-button.add')
		const liveRegion = first('[role="status"]')

		const max = asInteger(MAX_ITEMS)(host.getAttribute('max'))

		let addKey = 0
		let selectedItem: HTMLElement | null = null
		let dragItem: HTMLElement | null = null
		let marker: HTMLElement | null = null
		let dragOffsetY = 0
		let pendingDragHandle: HTMLElement | null = null
		let pointerStartY = 0
		let pointerStartX = 0
		let suppressNextClick = false

		function announce(msg: string) {
			if (liveRegion) liveRegion.textContent = msg
		}

		function getItemText(item: HTMLElement): string {
			return item.querySelector('span')?.textContent?.trim() ?? 'item'
		}

		function selectItem(item: HTMLElement | null) {
			if (selectedItem) {
				selectedItem.classList.remove('selected')
				selectedItem
					.querySelector('.drag-handle')
					?.setAttribute('aria-pressed', 'false')
			}
			selectedItem = item
			if (item) {
				item.classList.add('selected')
				item.querySelector('.drag-handle')?.setAttribute('aria-pressed', 'true')
				const items = Array.from(container.children)
				const idx = items.indexOf(item) + 1
				const total = items.length
				announce(
					`${getItemText(item)} selected, position ${idx} of ${total}. ` +
						`Press Up or Down arrow to move, Escape to cancel.`,
				)
			}
		}

		function moveItem(item: HTMLElement, direction: -1 | 1) {
			const items = Array.from(container.children) as HTMLElement[]
			const idx = items.indexOf(item)
			const newIdx = idx + direction
			if (newIdx < 0 || newIdx >= items.length) return
			const sibling = items[newIdx]!
			if (direction === 1) sibling.after(item)
			else sibling.before(item)
			const newPos = Array.from(container.children).indexOf(item) + 1
			announce(
				`${getItemText(item)} moved to position ${newPos} of ${container.children.length}.`,
			)
			item.querySelector<HTMLElement>('.drag-handle')?.focus()
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
					(textbox && !textbox.length) || container.children.length >= max,
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

				if (target.closest('basic-button.delete')) {
					e.stopPropagation()
					const item = target.closest('[data-key]')
					if (item instanceof HTMLElement) {
						if (item === selectedItem) selectItem(null)
						item.remove()
					}
					return
				}

				const handle = target.closest('.drag-handle')
				if (handle instanceof HTMLElement) {
					const item = handle.closest('[data-key]')
					if (item instanceof HTMLElement) {
						selectItem(selectedItem === item ? null : item)
					}
				}
			}),

			on(host, 'keydown', e => {
				if (!selectedItem) return
				const target = e.target as HTMLElement
				if (!target.classList.contains('drag-handle')) return
				if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Escape')
					return
				e.preventDefault()
				if (e.key === 'ArrowUp') moveItem(selectedItem, -1)
				else if (e.key === 'ArrowDown') moveItem(selectedItem, 1)
				else selectItem(null)
			}),

			on(host, 'pointerdown', e => {
				const handle = (e.target as HTMLElement).closest('.drag-handle')
				if (!(handle instanceof HTMLElement)) return
				const item = handle.closest('[data-key]')
				if (!(item instanceof HTMLElement)) return
				e.preventDefault()
				pendingDragHandle = handle
				pointerStartY = e.clientY
				pointerStartX = e.clientX
				suppressNextClick = false
				handle.setPointerCapture(e.pointerId)
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
					marker.style.height = `${rect.height}px`
					marker.setAttribute('aria-hidden', 'true')
					container.insertBefore(marker, item)

					item.style.top = `${rect.top}px`
					item.style.left = `${rect.left}px`
					item.style.width = `${rect.width}px`
					item.classList.add('dragging')

					if (selectedItem) selectItem(null)
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
					dragItem.classList.remove('dragging')
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
					dragItem.classList.remove('dragging')
					dragItem = null
					marker = null
				}
				pendingDragHandle = null
				suppressNextClick = false
			}),
		]
	},
)
