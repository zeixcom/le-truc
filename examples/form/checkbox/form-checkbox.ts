import { bindText, defineComponent } from '../../..'

export type FormCheckboxProps = {
	checked: boolean
	label: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-checkbox': HTMLElement & FormCheckboxProps
	}
}

export default defineComponent<FormCheckboxProps>(
	'form-checkbox',
	({ expose, first, host, on, watch }) => {
		const checkbox = first('input[type="checkbox"]', 'Add a native checkbox.')
		const label = first('.label')

		expose({
			checked: checkbox.checked,
			label: label?.textContent ?? first('label')?.textContent ?? '',
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
