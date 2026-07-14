import {
	batch,
	bindText,
	bindVisible,
	createMemo,
	createState,
	defineComponent,
	defineMethod,
	type FormAssociatedElement,
} from '../../..'

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
 * Form participation and validity are via ElementInternals (`formAssociated: true`).
 * External consumers read `host.validationMessage` / `host.validity` like on a native input.
 * @demo {./docs/examples/form-combobox.html} Interactive preview and usage examples */
export default defineComponent<FormComboboxProps>(
	'form-combobox',
	({ expose, first, host, on, pass, watch }) => {
		const textbox = first('input', 'Needed to enter value.')
		const listbox = first('form-listbox', 'Needed to display options.')
		const clearBtn = first('button.clear')
		const errorEl = first('form-combobox > .error')
		const descriptionEl = first('.description')

		const descriptionId = descriptionEl?.id
		if (descriptionId) textbox.setAttribute('aria-describedby', descriptionId)

		const showPopup = createState(false)
		const isExpanded = createMemo(
			() => showPopup.get() && listbox.options.length > 0,
		)
		const length = createState(textbox.value.length)
		// Internal error state — not a public prop. External consumers read
		// host.validationMessage / host.validity (native parity).
		const error = createState('')

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
				const msg = textbox.validationMessage ?? ''
				batch(() => {
					host.value = textbox.value
					error.set(msg)
					host.setCustomValidity(msg)
					showPopup.set(true)
				})
			}),
			on(textbox, 'keydown', ({ key, altKey }) => {
				if (key === 'ArrowDown') {
					if (altKey) showPopup.set(true)
					if (isExpanded.get()) listbox.options[0]?.focus()
				}
			}),
			// Listen to listbox's host change event (native-parity commit event)
			// instead of reaching into its DOM with closest('[role="option"]').
			on(listbox, 'change', () => {
				const optionValue = (listbox as any).value
				if (!optionValue) return
				textbox.value = optionValue
				textbox.checkValidity()
				const msg = textbox.validationMessage ?? ''
				batch(() => {
					host.value = optionValue
					error.set(msg)
					host.setCustomValidity(msg)
					showPopup.set(false)
					textbox.focus()
				})
			}),
			on(clearBtn, 'click', () => {
				host.clear()
			}),

			// Form value sync: managed (value → setFormValue via ElementInternals)
			// Form reset: managed (value attribute is the default)
			// Validity: host.setCustomValidity() drives native :invalid /
			// :user-invalid + host.validationMessage for external consumers.
			errorEl && watch(error, bindText(errorEl)),
			descriptionEl && watch('description', bindText(descriptionEl)),
			watch(isExpanded, expanded => {
				listbox.hidden = !expanded
				textbox.ariaExpanded = String(expanded)
			}),
			clearBtn && watch(length, bindVisible(clearBtn)),
		]
	},
	{ formAssociated: true },
)
