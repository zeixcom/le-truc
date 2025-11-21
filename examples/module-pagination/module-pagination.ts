import {
	asInteger,
	type Component,
	component,
	on,
	read,
	setAttribute,
	setProperty,
	setText,
	show,
} from '../..'

type ModulePaginationProps = {
	readonly ui: {
		input: HTMLInputElement
		prev: HTMLButtonElement
		next: HTMLButtonElement
		value: HTMLElement | null
		max: HTMLElement | null
	}
	value: number
	max: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-pagination': Component<ModulePaginationProps>
	}
}

export default component<ModulePaginationProps>(
	'module-pagination',
	{
		ui: ({ first }) => ({
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
		value: read({ input: getProperty('value') }, asInteger(1)),
		max: read({ input: getProperty('max') }, asInteger(1)),
	},
	el => ({
		component: [
			show(() => el.max > 1),
			setAttribute('value', () => String(el.value)),
			setAttribute('max', () => String(el.max)),
			on('keyup', ({ event }) => {
				if ((event.target as HTMLElement)?.localName === 'input') return
				const key = event.key
				if ((key === 'ArrowLeft' || key === '-') && el.value > 1)
					el.value--
				else if (
					(key === 'ArrowRight' || key === '+')
					&& el.value < el.max
				)
					el.value++
			}),
		],
		input: [
			on('change', ({ target }) => {
				el.value = Math.max(1, Math.min(target.valueAsNumber, el.max))
			}),
			setProperty('value', () => String(el.value)),
			setProperty('max', () => String(el.max)),
		],
		prev: [
			on('click', () => {
				el.value--
			}),
			setProperty('disabled', () => el.value <= 1),
		],
		next: [
			on('click', () => {
				el.value++
			}),
			setProperty('disabled', () => el.value >= el.max),
		],
		value: [setText(() => String(el.value))],
		max: [setText(() => String(el.max))],
	}),
)
