import { bindText, defineComponent } from '../../..'
import { asClampedInteger } from '../../_common/asClampedInteger'

export type ModulePaginationProps = {
	max: number
	value: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-pagination': HTMLElement & ModulePaginationProps
	}
}

export default defineComponent<ModulePaginationProps>(
	'module-pagination',
	({ expose, first, host, on, watch }) => {
		const input = first(
			'input',
			'Add an <input[type="number"]> to enter the page number to go to.',
		)
		const prev = first(
			'button.prev',
			'Add a <button.prev> to go to the previous page.',
		)
		const next = first(
			'button.next',
			'Add a <button.next> to go to the next page.',
		)
		const valueEl = first('.value')
		const maxEl = first('.max')

		const maxInit = asClampedInteger(1)({} as any, input.max)
		const valueInit = asClampedInteger(1, maxInit)({} as any, input.value)

		expose({
			max: maxInit,
			value: valueInit,
		})

		return [
			watch(['value', 'max'], () => {
				host.hidden = host.max <= 1
				host.setAttribute('value', String(host.value))
				host.setAttribute('max', String(host.max))
			}),
			on(host, 'keyup', (e, target) => {
				const { key } = e
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
			on(input, 'change', () => {
				const numValue = input.valueAsNumber
				const clamped = Number.isNaN(numValue)
					? 1
					: Math.max(1, Math.min(numValue, host.max))
				input.valueAsNumber = clamped
				host.value = clamped
			}),
			on(prev, 'click', () => {
				host.value--
				if (host.value <= 1) next.focus()
			}),
			watch(['value', 'max'], () => {
				input.value = String(host.value)
				input.max = String(host.max)
				prev.disabled = host.value <= 1
				next.disabled = host.value >= host.max
			}),
			on(next, 'click', () => {
				host.value++
				if (host.value >= host.max) prev.focus()
			}),
			valueEl && watch('value', bindText(valueEl)),
			maxEl && watch('max', bindText(maxEl)),
		]
	},
)
