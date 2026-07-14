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
 * Use it for searchable selection — provides ARIA roles for the combobox pattern,
 * keyboard interaction (type to filter, Escape to close, Enter to select), and focus management.
 * Form participation and validity are via ElementInternals (`formAssociated: true`, `setFormValue`, `setValidity`).
 * @demo {./docs/examples/form-combobox.html} Interactive preview and usage examples */
export default defineComponent<FormComboboxProps>(
	'form-combobox',
	({ expose, first, host, internals, on, onFormReset, pass, watch }) => {
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
			on(listbox, 'click', ({ target }) => {
				const option = (target as HTMLElement).closest(
					'[role="option"]',
				) as HTMLButtonElement | null
				if (!option) return
				textbox.value = option.value
				textbox.checkValidity()
				batch(() => {
					host.value = option.value
					host.error = textbox.validationMessage ?? ''
					showPopup.set(false)
					textbox.focus()
				})
			}),
			on(clearBtn, 'click', () => {
				host.clear()
			}),

			watch('value', bindAttribute(host, 'value')),
			watch('value', v => {
				internals?.setFormValue(v)
			}),
			watch('error', error => {
				internals?.setValidity({ customError: !!error }, error || undefined)
				host.ariaInvalid = String(!!error)
				if (error && errorId) host.setAttribute('aria-errormessage', errorId)
				else host.removeAttribute('aria-errormessage')
			}),
			errorEl && watch('error', bindText(errorEl)),
			descriptionEl && watch('description', bindText(descriptionEl)),
			watch(isExpanded, expanded => {
				listbox.hidden = !expanded
				textbox.ariaExpanded = String(expanded)
			}),
			clearBtn && watch(length, bindVisible(clearBtn)),
			onFormReset(() => {
				host.value = ''
				host.error = ''
			}),
		]
	},
	{ formAssociated: true },
)
