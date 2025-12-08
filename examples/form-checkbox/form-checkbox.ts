import {
	asString,
	type Component,
	createSensor,
	defineComponent,
	read,
	setText,
	toggleAttribute,
} from '../..'

export type FormCheckboxProps = {
	readonly checked: boolean
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
		checked: createSensor(
			read(ui => ui.checkbox.checked, false),
			'checkbox',
			{ change: ({ target }) => target.checked },
		),
		label: asString(
			ui =>
				ui.label?.textContent
				?? ui.host.querySelector('label')?.textContent
				?? '',
		),
	},
	({ first }) => ({
		checkbox: first('input[type="checkbox"]', 'Add a native checkbox.'),
		label: first('.label'),
	}),
	() => ({
		host: [toggleAttribute('checked')],
		label: [setText('label')],
	}),
)
