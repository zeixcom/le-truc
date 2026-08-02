import {
	bindProperty,
	bindText,
	bindVisible,
	createMemo,
	createState,
	defineComponent,
	defineMethod,
	type FormAssociatedElement,
	formAssociated,
} from '../../..'

export type FormTextboxProps = {
	/** Current text value. Synced with the native input or textarea. */
	value: string
	/** Character length of the current value (read-only). */
	readonly length: number
	/** Helper text shown below the input. May include a remaining-characters template. */
	description: string
	/** Clears the input value and dispatches `input` and `change` events. */
	clear: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-textbox': FormAssociatedElement & FormTextboxProps
	}
}

/**
 * A single-line or multiline text input with validation, optional clear button, and helper text.
 * Use it when you need a styled text field — the underlying native input provides
 * keyboard accessibility and standard ARIA textbox semantics. Form participation
 * and validity are via ElementInternals (`formAssociated()`).
 * External consumers read `host.validationMessage` / `host.validity` like on a
 * native input; inline error display binds directly to `host.validationMessage`.
 * Sets the `:state(clearable)` custom state when a `button.clear` descendant
 * is present, so CSS can reserve space for it — derived from markup, not an
 * author-set attribute, so it can't drift out of sync or be spoofed.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-textbox} Interactive preview and usage examples
 **/
export default defineComponent<FormTextboxProps>(
	'form-textbox',
	({ expose, first, host, internals, on, watch }) => {
		const textbox = first(
			'input, textarea',
			'Add a native input or textarea as descendant element.',
		)
		const length = createState(textbox.value.length)

		// Reactive description: tracks remaining character count if template is present
		const descriptionEl = first('.description')
		const descriptionMemo =
			descriptionEl && textbox.maxLength > 0 && descriptionEl.dataset.remaining
				? createMemo(() =>
						descriptionEl.dataset.remaining!.replace(
							'${n}',
							String(textbox.maxLength - host.length),
						),
					)
				: null

		expose({
			value: textbox.value,
			length: length.get,
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

		on(textbox, 'change', () => {
			textbox.checkValidity()
			host.setCustomValidity(textbox.validationMessage ?? '')
			return { value: textbox.value }
		})
		on(textbox, 'input', () => {
			length.set(textbox.value.length)
		})
		watch('value', bindProperty(textbox, 'value'))

		const clearBtn = first('button.clear')
		if (clearBtn) {
			internals?.states.add('clearable')
			on(clearBtn, 'click', () => {
				host.clear()
			})
			watch(length, bindVisible(clearBtn))
		}

		if (descriptionEl) {
			const descriptionId = descriptionEl?.id
			if (descriptionId) textbox.setAttribute('aria-describedby', descriptionId)
			watch('description', bindText(descriptionEl))
		}

		const errorEl = first('.error')
		if (errorEl) watch('validationMessage', bindText(errorEl))
	},
	[formAssociated()],
)
