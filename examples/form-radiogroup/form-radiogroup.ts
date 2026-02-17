import {
	type Component,
	createEventsSensor,
	defineComponent,
	type Memo,
	read,
	setProperty,
	toggleClass,
} from '../..'
import { manageFocus } from '../_common/focus'

export type FormRadiogroupProps = {
	readonly value: string
}

type FormRadiogroupUI = {
	radios: Memo<HTMLInputElement[]>
	labels: Memo<HTMLLabelElement[]>
}

declare global {
	interface HTMLElementTagNameMap {
		'form-radiogroup': Component<FormRadiogroupProps>
	}
}

const getIndex = (radios: HTMLInputElement[]) =>
	radios.findIndex(radio => radio.checked)

export default defineComponent<FormRadiogroupProps, FormRadiogroupUI>(
	'form-radiogroup',
	{
		value: createEventsSensor(
			read(({ radios }) => {
				const radiosArray = radios.get()
				return radiosArray[getIndex(radiosArray)]?.value
			}, ''),
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
		host: manageFocus(() => radios.get(), getIndex),
		radios: setProperty('tabIndex', target =>
			target.value === host.value ? 0 : -1,
		),
		labels: toggleClass(
			'selected',
			target => host.value === target.querySelector('input')?.value,
		),
	}),
)
