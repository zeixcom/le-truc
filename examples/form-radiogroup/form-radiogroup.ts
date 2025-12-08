import {
	type Collection,
	type Component,
	createSensor,
	defineComponent,
	read,
	setProperty,
	toggleClass,
} from '../..'
import { manageFocus } from '../_common/focus'

type FormRadiogroupProps = {
	readonly value: string
}

type FormRadiogroupUI = {
	radios: Collection<HTMLInputElement>
	labels: Collection<HTMLLabelElement>
}

declare global {
	interface HTMLElementTagNameMap {
		'form-radiogroup': Component<FormRadiogroupProps>
	}
}

const getIndex = (radios: Collection<HTMLInputElement>) =>
	radios.get().findIndex(radio => radio.checked)

export default defineComponent<FormRadiogroupProps, FormRadiogroupUI>(
	'form-radiogroup',
	{
		value: createSensor(
			read(({ radios }) => radios[getIndex(radios)]?.value, ''),
			'radios',
			{
				change: ({ target }) => target.value,
			},
		),
	},
	({ all }) => ({
		radios: all(
			'input[type="radio"]',
			'Add at least two native radio buttons.',
		),
		labels: all('label', 'Wrap radio buttons with labels.'),
	}),
	({ host, radios }) => ({
		host: [...manageFocus(radios, getIndex)],
		radios: [
			setProperty('tabIndex', target => (target.value === host.value ? 0 : -1)),
		],
		labels: [
			toggleClass(
				'selected',
				target => host.value === target.querySelector('input')?.value,
			),
		],
	}),
)
