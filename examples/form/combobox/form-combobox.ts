import {
	batch,
	bindAttribute,
	bindText,
	bindVisible,
	createMemo,
	createState,
	defineComponent,
	defineMethod,
} from '../../..'

export type FormComboboxProps = {
	/** Current text input value. Updated on each `input` event. */
	value: string
	/** Character length of the current value (read-only). */
	readonly length: number
	/** Validation error message. Set from `textbox.validationMessage`. */
	error: string
	/** Helper text shown below the input. */
	description: string
	/** Clears the input and dispatches `input` and `change` events. */
	clear: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-combobox': HTMLElement & FormComboboxProps
	}
}

/**
 * A combobox (searchable select) that combines a text input with a filterable listbox popup.
 */
export default defineComponent<FormComboboxProps>(
	'form-combobox',
	({ expose, first, host, on, pass, watch }) => {
		const textbox = first('input', 'Needed to enter value.')
		const listbox = first('form-listbox', 'Needed to display options.')
		const clearBtn = first('button.clear')
		const errorEl = first('form-combobox > .error')
		const descriptionEl = first('.description')

		const errorId = errorEl?.id
		const descriptionId = descriptionEl?.id
		if (descriptionId) textbox.setAttribute('aria-describedby', descriptionId)

		const showPopup = createState(false)
		const isExpanded = createMemo(
			() => showPopup.get() && listbox.options.length > 0,
		)
		const length = createState(textbox.value.length)

		expose({
			value: textbox.value,
			length: length.get,
			error: '',
			description: descriptionEl?.textContent?.trim() ?? '',
			clear: defineMethod(() => {
				host.value = ''
				textbox.value = ''
				textbox.setCustomValidity('')
				textbox.checkValidity()
				textbox.dispatchEvent(new Event('input', { bubbles: true }))
				textbox.dispatchEvent(new Event('change', { bubbles: true }))
				textbox.focus()
			}),
		})

		return [
			pass(listbox, { filter: () => host.value }),

			on(host, 'keyup', ({ key }: KeyboardEvent) => {
				if (key === 'Escape') {
					showPopup.set(false)
					textbox.focus()
				}
				if (key === 'Delete') host.clear()
			}),
			on(textbox, 'input', () => {
				length.set(textbox.value.length)
				textbox.checkValidity()
				batch(() => {
					host.value = textbox.value
					host.error = textbox.validationMessage ?? ''
					showPopup.set(true)
				})
			}),
			on(textbox, 'keydown', ({ key, altKey }) => {
				if (key === 'ArrowDown') {
					if (altKey) showPopup.set(true)
					if (isExpanded.get()) listbox.options[0]?.focus()
				}
			}),
			on(listbox, 'change', ({ target }: Event) => {
				if (target instanceof HTMLInputElement) {
					textbox.value = target.value
					textbox.checkValidity()
					batch(() => {
						host.value = target.value
						host.error = textbox.validationMessage ?? ''
						showPopup.set(false)
						textbox.focus()
					})
				}
			}),
			on(clearBtn, 'click', () => {
				host.clear()
			}),

			watch('value', bindAttribute(host, 'value')),
			watch('error', error => {
				textbox.ariaInvalid = String(!!error)
				if (error && errorId) textbox.setAttribute('aria-errormessage', errorId)
				else textbox.removeAttribute('aria-errormessage')
			}),
			errorEl && watch('error', bindText(errorEl)),
			descriptionEl && watch('description', bindText(descriptionEl)),
			watch(isExpanded, expanded => {
				listbox.hidden = !expanded
				textbox.ariaExpanded = String(expanded)
			}),
			clearBtn && watch(length, bindVisible(clearBtn)),
		]
	},
)
