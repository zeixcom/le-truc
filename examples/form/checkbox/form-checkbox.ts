import { bindText, defineComponent } from '../../..'

export type FormCheckboxProps = {
	/** Whether the checkbox is checked. Synced with the native checkbox state. */
	checked: boolean
	/** Visible label text of the checkbox. */
	label: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-checkbox': HTMLElement & FormCheckboxProps
	}
}

/**
 * A styled checkbox component that syncs its state with a native checkbox input.
 */
export default defineComponent<FormCheckboxProps>(
	'form-checkbox',
	({ expose, first, host, on, watch }) => {
		const checkbox = first('input[type="checkbox"]', 'Add a native checkbox.')
		const label = first('.label') ?? first('label')

		expose({
			checked: checkbox.checked,
			label: label?.textContent ?? '',
		})

		return [
			on(checkbox, 'change', () => ({ checked: checkbox.checked })),

			watch('checked', checked => {
				checkbox.checked = checked
				host.toggleAttribute('checked', checked)
			}),
			label && watch('label', bindText(label)),
		]
	},
)
