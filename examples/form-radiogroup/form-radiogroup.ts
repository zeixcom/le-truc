import {
	Collection,
	type Component,
	createSensor,
	defineComponent,
	on,
	read,
	setProperty,
	toggleClass,
} from '../..'

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

const DECREMENT_KEYS = ['ArrowLeft', 'ArrowUp']
const INCREMENT_KEYS = ['ArrowRight', 'ArrowDown']
const FIRST_KEY = 'Home'
const LAST_KEY = 'End'
const HANDLED_KEYS = [...DECREMENT_KEYS, ...INCREMENT_KEYS, FIRST_KEY, LAST_KEY]

const getIndex = (radios: Collection<HTMLInputElement>) =>
	radios.get().findIndex(radio => radio.checked)

const manageFocus = (
	radios: Collection<HTMLInputElement>,
	getCheckedIndex: (radios: Collection<HTMLInputElement>) => number,
) => {
	let index = getCheckedIndex(radios)

	return [
		on('click', () => {
			index = getCheckedIndex(radios)
		}),
		on('focus', ({ target }) => {
			index = radios.get().findIndex(radio => radio === target)
		}),
		on('keydown', ({ event }) => {
			const { key } = event
			if (!HANDLED_KEYS.includes(key)) return
			event.preventDefault()
			event.stopPropagation()
			if (key === FIRST_KEY) index = 0
			else if (key === LAST_KEY) index = radios.length - 1
			else
				index =
					(index +
						(INCREMENT_KEYS.includes(key) ? 1 : -1) +
						radios.length) %
					radios.length
			if (radios[index]) radios[index].focus()
		}),
	]
}

export default defineComponent<FormRadiogroupProps, FormRadiogroupUI>(
	'form-radiogroup',
	{
		value: createSensor(
			'radios',
			read(({ radios }) => radios[getIndex(radios)]?.value, ''),
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
		radios: [
			setProperty('tabIndex', target =>
				target.value === host.value ? 0 : -1,
			),
			...manageFocus(radios, getIndex),
			on('keyup', ({ event, target }) => {
				if (event.key === 'Enter') target.click()
			}),
		],
		labels: [
			toggleClass(
				'selected',
				target => host.value === target.querySelector('input')?.value,
			),
		],
	}),
)
