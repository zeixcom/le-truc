import {
	asBoolean,
	bindProperty,
	bindText,
	defineComponent,
	type FormAssociatedElement,
	formAssociatedCheckbox,
} from '../../../index'

export type FormCheckboxProps = {
	/**
	 * Whether the checkbox is checked. Read from the host's own `checked`
	 * attribute at connect time — set it on `<form-checkbox>`, not the
	 * inner native input — and restored to that default on `<form>.reset()`.
	 */
	checked: boolean
	/** Visible label text of the checkbox. */
	label: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-checkbox': FormAssociatedElement & FormCheckboxProps
	}
}

/**
 * A styled checkbox component that syncs its state with a native checkbox input.
 * Use it when you need a visually customisable checkbox — the underlying native
 * input provides keyboard accessibility (Space to toggle) and ARIA semantics.
 * Form participation is via ElementInternals (`formAssociatedCheckbox()`) —
 * submits nothing when unchecked, matching native `<input type="checkbox">`.
 * Set `name` and `value` on `<form-checkbox>` itself, not the inner native
 * input — the host is the sole source of truth for form submission; the
 * inner input's own `name`/`value` (if any) are inert.
 * Style the checked state via `:has(input:checked)` on the host — native
 * `:checked` only applies to `<input>`/`<option>` elements directly, never to
 * the custom element itself, so this reads it off the real descendant input
 * rather than reflecting to a `[checked]` attribute (which would corrupt the
 * `checked` *attribute*'s role as the reset default — native `defaultChecked`
 * semantics).
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-checkbox} Interactive preview and usage examples
 **/
export default defineComponent<FormCheckboxProps>(
	'form-checkbox',
	({ expose, first, on, watch }) => {
		const label = first('.label') ?? first('label')

		expose({
			checked: asBoolean(),
			label: label?.textContent ?? '',
		})

		const checkbox = first('input[type="checkbox"]', 'Add a native checkbox.')
		on(checkbox, 'change', () => ({ checked: checkbox.checked }))
		watch('checked', bindProperty(checkbox, 'checked'))
		watch('disabled', bindProperty(checkbox, 'disabled'))

		if (label) watch('label', bindText(label))
	},
	[formAssociatedCheckbox()],
)
