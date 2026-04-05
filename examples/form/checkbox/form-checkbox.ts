import { asString, type Component, defineComponent } from '../../..'

export type FormCheckboxProps = {
	checked: boolean
	label: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-checkbox': Component<FormCheckboxProps>
	}
}

export default defineComponent<FormCheckboxProps>(
	'form-checkbox',
	({ expose, first, host, on, run }) => {
		const checkbox = first('input[type="checkbox"]', 'Add a native checkbox.')
		const label = first('.label')

		expose({
			checked: checkbox.checked,
			label: asString(label?.textContent ?? first('label')?.textContent ?? ''),
		})

		return [
			on(checkbox, 'change', () => ({ checked: checkbox.checked })),
			run('checked', checked => {
				checkbox.checked = checked
				host.toggleAttribute('checked', checked)
			}),
			label
				&& run('label', text => {
					label.textContent = text
				}),
		]
	},
)
