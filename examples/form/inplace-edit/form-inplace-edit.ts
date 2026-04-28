import { asBoolean, bindText, defineComponent } from '../../..'

export type FormInplaceEditProps = {
	editing: boolean
	value: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-inplace-edit': HTMLElement & FormInplaceEditProps
	}
}

let idCounter = 0

export default defineComponent<FormInplaceEditProps>(
	'form-inplace-edit',
	({ expose, first, host, on, watch }) => {
		const textEl = first(
			'.text',
			'Add an element with "text" class for label display.',
		)
		const editBtn = first(
			'button',
			'Add a <button> element for edit mode toggle.',
		)

		const editInputId = `form-inplace-edit-input${++idCounter}`
		let input: HTMLInputElement | null = null

		expose({
			editing: asBoolean(),
			value: textEl.textContent?.trim() ?? '',
		})

		return [
			on(editBtn, 'click', e => {
				e.stopPropagation()
				if (host.editing && input)
					return {
						editing: false,
						value: input.value,
					}
				else host.editing = !host.editing
			}),
			on(textEl, 'dblclick', () => {
				host.editing = true
			}),
			on(host, 'keydown', e => {
				if (!host.editing) return
				if (e.key !== 'Escape' && e.key !== 'Enter') return
				e.preventDefault()
				if (input && e.key === 'Enter')
					return {
						editing: false,
						value: input.value,
					}
				else host.editing = false
			}),
			on(editBtn, 'mousedown', e => {
				e.preventDefault()
			}),
			on(host, 'focusout', e => {
				if (!host.editing) return
				const relatedTarget = e.relatedTarget as Element | null
				if (relatedTarget && host.contains(relatedTarget)) return
				host.editing = false
			}),

			watch('value', bindText(textEl)),
			watch('editing', editing => {
				host.toggleAttribute('editing', editing)
				if (editing) {
					const textboxEl = document.createElement('form-textbox')
					const labelEl = document.createElement('label')
					labelEl.className = 'visually-hidden'
					labelEl.setAttribute('for', editInputId)
					labelEl.textContent = 'Edit'
					const inputWrapper = document.createElement('div')
					inputWrapper.className = 'input'
					input = document.createElement('input')
					input.type = 'text'
					input.id = editInputId
					input.value = host.value
					inputWrapper.append(input)
					textboxEl.append(labelEl, inputWrapper)
					host.insertBefore(textboxEl, textEl)
					editBtn.textContent = '✓'
					editBtn.setAttribute('aria-label', 'Accept')
					input.focus()
					input.select()
				} else {
					first('form-textbox')?.remove()
					editBtn.textContent = '✎'
					editBtn.setAttribute('aria-label', 'Edit')
				}
			}),
		]
	},
)
