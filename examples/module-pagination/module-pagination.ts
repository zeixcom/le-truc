import {
	asInteger,
	type Component,
	defineComponent,
	on,
	read,
	setAttribute,
	setProperty,
	setText,
	show,
} from '../..'

type ModulePaginationProps = {
	value: number
	max: number
}

type ModulePaginationUI = {
	input: HTMLInputElement
	prev: HTMLButtonElement
	next: HTMLButtonElement
	value?: HTMLElement
	max?: HTMLElement
}

declare global {
	interface HTMLElementTagNameMap {
		'module-pagination': Component<ModulePaginationProps>
	}
}

export default defineComponent<ModulePaginationProps, ModulePaginationUI>(
	'module-pagination',
	{
		value: read(ui => ui.input.value, asInteger(1)),
		max: read(ui => ui.input.max, asInteger(1)),
	},
	({ first }) => ({
		input: first(
			'input',
			'Add an <input[type="number"]> to enter the page number to go to.',
		),
		prev: first(
			'button.prev',
			'Add a <button.prev> to go to the previous page.',
		),
		next: first(
			'button.next',
			'Add a <button.next> to go to the next page.',
		),
		value: first('.value'),
		max: first('.max'),
	}),
	({ host }) => ({
		host: [
			show(() => host.max > 1),
			setAttribute('value', () => String(host.value)),
			setAttribute('max', () => String(host.max)),
			on('keyup', ({ event }) => {
				if ((event.target as HTMLElement)?.localName === 'input') return
				const key = event.key
				if ((key === 'ArrowLeft' || key === '-') && host.value > 1)
					host.value--
				else if (
					(key === 'ArrowRight' || key === '+')
					&& host.value < host.max
				)
					host.value++
			}),
		],
		input: [
			on('change', ({ target }) => {
				host.value = Math.max(
					1,
					Math.min(target.valueAsNumber, host.max),
				)
			}),
			setProperty('value', () => String(host.value)),
			setProperty('max', () => String(host.max)),
		],
		prev: [
			on('click', () => {
				host.value--
			}),
			setProperty('disabled', () => host.value <= 1),
		],
		next: [
			on('click', () => {
				host.value++
			}),
			setProperty('disabled', () => host.value >= host.max),
		],
		value: [setText(() => String(host.value))],
		max: [setText(() => String(host.max))],
	}),
)
