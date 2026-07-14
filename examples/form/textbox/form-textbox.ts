import {
	bindProperty,
	bindText,
	bindVisible,
	createMemo,
	createState,
	defineComponent,
	defineMethod,
} from '../../..'

export type FormTextboxProps = {
	/** Current text value. Synced with the native input or textarea. */
	value: string
	/** Character length of the current value (read-only). */
	readonly length: number
	/** Validation error message from the native input's `validationMessage`. */
	error: string
	/** Helper text shown below the input. May include a remaining-characters template. */
	description: string
	/** Clears the input value and dispatches `input` and `change` events. */
	clear: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-textbox': HTMLElement & FormTextboxProps
	}
}

/**
 * A single-line or multiline text input with validation, optional clear button, and helper text.
 * Use it when you need a styled text field — the underlying native input provides
 * keyboard accessibility and standard ARIA textbox semantics. Form participation
 * and validity are via ElementInternals (`formAssociated: true`, `setFormValue`, `setValidity`).
 * @demo {./docs/examples/form-textbox.html} Interactive preview and usage examples */
export default defineComponent<FormTextboxProps>(
	'form-textbox',
	({ expose, first, host, internals, on, onFormReset, watch }) => {
		const textbox = first(
			'input, textarea',
			'Add a native input or textarea as descendant element.',
		)
		const clearBtn = first('button.clear')
		const errorEl = first('.error')
		const descriptionEl = first('.description')

		const errorId = errorEl?.id
		const descriptionId = descriptionEl?.id
		if (descriptionId) textbox.setAttribute('aria-describedby', descriptionId)

		// Reactive description: tracks remaining character count if template is present
		const descriptionMemo =
			descriptionEl && textbox.maxLength > 0 && descriptionEl.dataset.remaining
				? createMemo(() =>
						descriptionEl.dataset.remaining!.replace(
							'${n}',
							String(textbox.maxLength - host.length),
						),
					)
				: null

		const length = createState(textbox.value.length)

		expose({
			value: textbox.value,
			length: length.get,
			error: '',
			description: descriptionMemo ?? descriptionEl?.textContent?.trim() ?? '',
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
			on(textbox, 'change', () => {
				textbox.checkValidity()
				return {
					value: textbox.value,
					error: textbox.validationMessage,
				}
			}),
			on(textbox, 'input', () => {
				length.set(textbox.value.length)
			}),
			on(clearBtn, 'click', () => {
				host.clear()
			}),

			watch('value', v => {
				internals?.setFormValue(v)
				bindProperty(textbox, 'value')(v)
			}),
			watch('error', error => {
				internals?.setValidity({ customError: !!error }, error || undefined)
				host.ariaInvalid = String(!!error)
				if (error && errorId) host.setAttribute('aria-errormessage', errorId)
				else host.removeAttribute('aria-errormessage')
			}),
			errorEl && watch('error', bindText(errorEl)),
			descriptionEl && watch('description', bindText(descriptionEl)),
			clearBtn && watch(length, bindVisible(clearBtn)),
			onFormReset(() => {
				host.value = ''
				host.error = ''
			}),
		]
	},
	{ formAssociated: true },
)
