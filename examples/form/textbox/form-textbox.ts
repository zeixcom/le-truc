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
import { relayValidity } from '../../_common/relayValidity'

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
 * native input; inline error display binds to component-internal state.
 * @demo {./docs/examples/form-textbox.html} Interactive preview and usage examples */
export default defineComponent<FormTextboxProps>(
	'form-textbox',
	({ expose, first, host, on, watch }) => {
		const textbox = first(
			'input, textarea',
			'Add a native input or textarea as descendant element.',
		)
		const clearBtn = first('button.clear')
		const errorEl = first('.error')
		const descriptionEl = first('.description')

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
		// Internal error state — not a public prop. External consumers read
		// host.validationMessage / host.validity (native parity).
		const error = createState('')

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
			relayValidity(textbox, host, error)
			return { value: textbox.value }
		})
		on(textbox, 'input', () => {
			length.set(textbox.value.length)
		})
		on(clearBtn, 'click', () => {
			host.clear()
		})

		watch('value', v => {
			bindProperty(textbox, 'value')(v)
		})
		if (errorEl) watch(error, bindText(errorEl))
		if (descriptionEl) watch('description', bindText(descriptionEl))
		if (clearBtn) watch(length, bindVisible(clearBtn))
	},
	[formAssociated()],
)
