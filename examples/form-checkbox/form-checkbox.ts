import {
	asBoolean,
	asString,
	type Component,
	component,
	getText,
	on,
	read,
	setProperty,
	setText,
} from '../..'

type FormCheckboxProps = {
	checked: boolean
	label: string
}

type FormCheckboxUI = {
	checkbox: HTMLInputElement
	label: HTMLLabelElement
}

declare global {
	interface HTMLElementTagNameMap {
		'form-checkbox': Component<FormCheckboxProps, FormCheckboxUI>
	}
}

export default component<FormCheckboxProps, FormCheckboxUI>(
	'form-checkbox',
	({ first }) => ({
		checkbox: first('input[type="checkbox"]', 'Add a native checkbox.'),
		label: first('label', 'Add a native label.'),
	}),
	{
		checked: asBoolean(),
		label: asString(read({ label: getText() }, '')),
	},
	el => ({
		checkbox: [
			setProperty('checked'),
			on('change', ({ target }) => {
				el.checked = target.checked
			}),
		],
		label: [setText('label')],
	}),
)
