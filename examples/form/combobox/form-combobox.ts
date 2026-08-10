import {
	batch,
	bindText,
	bindVisible,
	createMemo,
	createState,
	defineComponent,
	defineMethod,
	type FormAssociatedElement,
	formAssociated,
} from '../../../index'

export type FormComboboxProps = {
	/** Current text input value. Updated on each `input` event. */
	value: string
	/** Character length of the current value (read-only). */
	readonly length: number
	/** Helper text shown below the input. */
	description: string
	/** Clears the input and dispatches `input` and `change` events. */
	clear: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-combobox': FormAssociatedElement & FormComboboxProps
	}
}

/**
 * A combobox (searchable select) that combines a text input with a filterable listbox popup.
 * Use it for searchable selection — provides ARIA roles for the combobox pattern,
 * keyboard interaction (type to filter, Escape to close, Enter to select), and focus management.
 * Form participation and validity are via ElementInternals (`formAssociated()`).
 * External consumers read `host.validationMessage` / `host.validity` like on a native input.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-combobox} Interactive preview and usage examples
 **/
export default defineComponent<FormComboboxProps>(
	'form-combobox',
	({ expose, first, host, on, pass, watch }) => {
		const textbox = first('input', 'Needed to enter value.')
		const listbox = first('form-listbox', 'Needed to display options.')
		const descriptionEl = first('.description')

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

		pass(listbox, { filter: () => host.value })

		on(host, 'keyup', ({ key }) => {
			if (key === 'Escape') {
				showPopup.set(false)
				textbox.focus()
			}
			if (key === 'Delete') host.clear()
		})
		on(textbox, 'input', () => {
			length.set(textbox.value.length)
			batch(() => {
				host.value = textbox.value
				textbox.checkValidity()
				host.setCustomValidity(textbox.validationMessage ?? '')
				showPopup.set(true)
			})
		})
		on(textbox, 'keydown', ({ key, altKey }) => {
			if (key === 'ArrowDown') {
				if (altKey) showPopup.set(true)
				if (isExpanded.get()) listbox.options[0]?.focus()
			}
		})

		// Listen to listbox's host change event (native-parity commit event)
		// instead of reaching into its DOM with closest('[role="option"]').
		on(listbox, 'change', () => {
			const optionValue = listbox.value
			textbox.value = optionValue
			batch(() => {
				host.value = optionValue
				textbox.checkValidity()
				host.setCustomValidity(textbox.validationMessage ?? '')
				showPopup.set(false)
				textbox.focus()
			})
		})

		const clearBtn = first('button.clear')
		on(clearBtn, 'click', () => {
			host.clear()
		})

		// Form value sync: managed (value → setFormValue via ElementInternals)
		// Form reset: managed (value attribute is the default)
		// Validity: host.setCustomValidity() drives native :invalid /
		// :user-invalid + host.validationMessage for external consumers.
		const errorEl = first('form-combobox > .error')
		if (errorEl) watch('validationMessage', bindText(errorEl))
		if (descriptionEl) watch('description', bindText(descriptionEl))

		watch(isExpanded, expanded => {
			listbox.hidden = !expanded
			textbox.ariaExpanded = String(expanded)
		})
		if (clearBtn) watch(length, bindVisible(clearBtn))
	},
	[formAssociated()],
)
