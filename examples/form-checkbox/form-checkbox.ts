import {
	asString,
	type Component,
	defineComponent,
	on,
	read,
	setProperty,
	setText,
	toggleAttribute,
} from '../..'

export type FormCheckboxProps = {
	checked: boolean
	label: string
}

type FormCheckboxUI = {
	checkbox: HTMLInputElement
	label?: HTMLElement
}

declare global {
	interface HTMLElementTagNameMap {
		'form-checkbox': Component<FormCheckboxProps>
	}
}

export default defineComponent<FormCheckboxProps, FormCheckboxUI>(
	'form-checkbox',
	{
		checked: read(ui => ui.checkbox.checked, false),
		label: asString(
			({ host, label }) =>
				label?.textContent ?? host.querySelector('label')?.textContent ?? '',
		),
	},
	({ first }) => ({
		checkbox: first('input[type="checkbox"]', 'Add a native checkbox.'),
		label: first('.label'),
	}),
	({ host, checkbox }) => ({
		host: toggleAttribute('checked'),
		checkbox: [
			on('change', () => {
				host.checked = checkbox.checked
			}),
			setProperty('checked'),
		],
		label: setText('label'),
	}),
)
