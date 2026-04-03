import {
	asString,
	type Component,
	defineComponent,
	on,
	read,
	setProperty,
	setText,
	toggleAttribute,
} from '../../..'

export type FormCheckboxProps = {
	checked: boolean
	label: string
}

type FormCheckboxUI = {
	checkbox: HTMLInputElement
	label?: HTMLElement | undefined
}

declare global {
	interface HTMLElementTagNameMap {
		'form-checkbox': Component<FormCheckboxProps>
	}
}

export default defineComponent<FormCheckboxProps, FormCheckboxUI>(
	'form-checkbox',
	({ first, host }) => {
		const checkbox = first('input[type="checkbox"]', 'Add a native checkbox.')
		const label = first('.label')
		return {
			ui: { checkbox, label },
			props: {
				checked: read(() => checkbox.checked, false),
				label: asString(
					() => label?.textContent ?? host.querySelector('label')?.textContent ?? '',
				),
			},
			effects: {
				host: toggleAttribute('checked'),
				checkbox: [
					on('change', () => ({ checked: checkbox.checked })),
					setProperty('checked'),
				],
				label: setText('label'),
			},
		}
	},
)
