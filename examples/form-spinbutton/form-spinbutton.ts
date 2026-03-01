import {
	asInteger,
	type Component,
	createMemo,
	defineComponent,
	type Memo,
	on,
	read,
	setProperty,
	show,
} from '../..'

export type FormSpinbuttonProps = {
	value: number
	max: number
}

type FormSpinbuttonUI = {
	controls: Memo<(HTMLButtonElement | HTMLInputElement)[]>
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
		value: read(ui => ui.input.value, asInteger()),
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
		const nonZero = createMemo(() => host.value !== 0)
		const incrementLabel = increment.ariaLabel || 'Increment'
		const ariaLabel = createMemo(() =>
			nonZero.get() || !zero ? incrementLabel : zero.textContent,
		)

		return {
			controls: [
				on('change', e => {
					const target = e.currentTarget as HTMLInputElement
					if (!(target instanceof HTMLInputElement)) return

					const next = Number(target.value)
					if (!Number.isInteger(next)) {
						target.value = String(host.value)
						target.checkValidity()
						return
					}
					const clamped = Math.min(host.max, Math.max(0, next))
					if (next !== clamped) {
						target.value = String(clamped)
						target.checkValidity()
					}
					host.value = clamped
				}),
				on('click', e => {
					const el = e.currentTarget as Element
					if (el.classList.contains('decrement')) {
						host.value = Math.max(0, host.value - 1)
					} else if (el.classList.contains('increment')) {
						host.value = Math.min(host.max, host.value + 1)
					}
				}),
				on('keydown', e => {
					const { key } = e as KeyboardEvent
					if (['ArrowUp', 'ArrowDown', '-', '+'].includes(key)) {
						e.stopPropagation()
						e.preventDefault()
						const delta = key === 'ArrowDown' || key === '-' ? -1 : 1
						host.value = Math.min(host.max, Math.max(0, host.value + delta))
					}
				}),
			],
			input: [
				show(nonZero),
				setProperty('value', () => String(host.value)),
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
