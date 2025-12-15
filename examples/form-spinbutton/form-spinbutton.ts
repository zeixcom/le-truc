import {
	asInteger,
	type Collection,
	type Component,
	createComputed,
	createSensor,
	defineComponent,
	read,
	setProperty,
	show,
} from '../..'

export type FormSpinbuttonProps = {
	readonly value: number
	max: number
}

type FormSpinbuttonUI = {
	controls: Collection<HTMLButtonElement | HTMLInputElement>
	increment: HTMLButtonElement
	decrement: HTMLButtonElement
	input: HTMLInputElement
	zero?: HTMLElement
	other?: HTMLElement
}

declare global {
	interface HTMLElementTagNameMap {
		'form-spinbutton': Component<FormSpinbuttonProps>
	}
}

export default defineComponent<FormSpinbuttonProps, FormSpinbuttonUI>(
	'form-spinbutton',
	{
		value: createSensor(
			read(ui => ui.input.value, asInteger()),
			'controls',
			{
				change: ({ ui, target, prev }) => {
					if (!(target instanceof HTMLInputElement)) return prev

					const resetTo = (next: number) => {
						target.value = String(next)
						target.checkValidity()
						return next
					}

					const next = Number(target.value)
					if (!Number.isInteger(next)) return resetTo(prev)
					const clamped = Math.min(ui.host.max, Math.max(0, next))
					if (next !== clamped) return resetTo(clamped)
					return clamped
				},
				click: ({ target, prev }) =>
					prev +
					(target.classList.contains('decrement')
						? -1
						: target.classList.contains('increment')
							? 1
							: 0),
				keydown: ({ ui, event, prev }) => {
					const { key } = event as KeyboardEvent
					if (['ArrowUp', 'ArrowDown', '-', '+'].includes(key)) {
						event.stopPropagation()
						event.preventDefault()
						const next = prev + (key === 'ArrowDown' || key === '-' ? -1 : 1)
						return Math.min(ui.host.max, Math.max(0, next))
					}
				},
			},
		),
		max: read(ui => ui.input.max, asInteger(10)),
	},
	({ all, first }) => ({
		controls: all('button, input:not([disabled])'),
		increment: first(
			'button.increment',
			'Add a native button to increment the value',
		),
		decrement: first(
			'button.decrement',
			'Add a native button to decrement the value',
		),
		input: first('input.value', 'Add a native input to display the value'),
		zero: first('.zero'),
		other: first('.other'),
	}),
	({ host, increment, zero }) => {
		const nonZero = createComputed(() => host.value !== 0)
		const incrementLabel = increment.ariaLabel || 'Increment'
		const ariaLabel = createComputed(() =>
			nonZero.get() || !zero ? incrementLabel : zero.textContent,
		)

		return {
			input: [
				show(nonZero),
				setProperty('value'),
				setProperty('max', () => String(host.max)),
			],
			decrement: show(nonZero),
			increment: [
				setProperty('disabled', () => host.value >= host.max),
				setProperty('ariaLabel', ariaLabel),
			],
			zero: show(() => !nonZero.get()),
			other: show(nonZero),
		}
	},
)
