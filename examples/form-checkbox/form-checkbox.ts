import {
	asBoolean,
	asString,
	type Component,
	component,
	on,
	setProperty,
	setText,
} from '../..'

type FormCheckboxProps = {
	checked: boolean
	label: string
}

type FormCheckboxUI = {
	checkbox: HTMLInputElement
	label?: HTMLLabelElement
}

declare global {
	interface HTMLElementTagNameMap {
		'form-checkbox': Component<FormCheckboxProps>
	}
}

export default component<FormCheckboxProps, FormCheckboxUI>(
	'form-checkbox',
	{
		checked: asBoolean(),
		label: asString(ui => ui.label?.textContent || ''),
	},
	({ first }) => ({
		checkbox: first('input[type="checkbox"]', 'Add a native checkbox.'),
		label: first('label', 'Add a native label.'),
	}),
	({ host }) => ({
		checkbox: [
			setProperty('checked'),
			on('change', ({ target }) => {
				host.checked = target.checked
			}),
		],
		label: [setText('label')],
	}),
)
