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
} from '../../..'
import { asClampedInteger } from '../../_common/asClampedInteger'

export type ModulePaginationProps = {
	max: number
	value: number
}

type ModulePaginationUI = {
	input: HTMLInputElement
	prev: HTMLButtonElement
	next: HTMLButtonElement
	max?: HTMLElement | undefined
	value?: HTMLElement | undefined
}

declare global {
	interface HTMLElementTagNameMap {
		'module-pagination': Component<ModulePaginationProps>
	}
}

export default defineComponent<ModulePaginationProps, ModulePaginationUI>(
	'module-pagination',
	{
		max: read(ui => ui.input.max, asClampedInteger(1)),
		value: read(
			ui => ui.input.value,
			asClampedInteger(1, ui => ui.host.max),
		),
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
		next: first('button.next', 'Add a <button.next> to go to the next page.'),
		value: first('.value'),
		max: first('.max'),
	}),
	({ host, input, prev, next }) => ({
		host: [
			show(() => host.max > 1),
			setAttribute('value', () => String(host.value)),
			setAttribute('max', () => String(host.max)),
			on('keyup', ({ target, key }) => {
				if (target instanceof HTMLInputElement) return

				let nextPage = host.value
				if ((key === 'ArrowLeft' || key === '-') && host.value > 1) nextPage--
				else if ((key === 'ArrowRight' || key === '+') && host.value < host.max)
					nextPage++
				if (document.activeElement === prev && nextPage <= 1) next.focus()
				else if (document.activeElement === next && nextPage >= host.max)
					prev.focus()
				host.value = nextPage
			}),
		],
		input: [
			on('change', () => {
				const numValue = input.valueAsNumber
				const clamped = Number.isNaN(numValue)
					? 1
					: Math.max(1, Math.min(numValue, host.max))
				input.valueAsNumber = clamped
				host.value = clamped
			}),
			setProperty('value', () => String(host.value)),
			setProperty('max', () => String(host.max)),
		],
		prev: [
			on('click', () => {
				host.value--
				if (host.value <= 1) next.focus()
			}),
			setProperty('disabled', () => host.value <= 1),
		],
		next: [
			on('click', () => {
				host.value++
				if (host.value >= host.max) prev.focus()
			}),
			setProperty('disabled', () => host.value >= host.max),
		],
		value: setText(() => String(host.value)),
		max: setText(() => String(host.max)),
	}),
)
