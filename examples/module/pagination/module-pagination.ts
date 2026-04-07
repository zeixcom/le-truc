import { asClampedInteger, bindText, defineComponent } from '../../..'

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

		expose({
			max: asClampedInteger(Number(input.max) ?? 1),
			value: asClampedInteger(input.valueAsNumber ?? 1, host.max),
		})

		return [
			on(host, 'keyup', e => {
				const { key } = e
				if (e.target instanceof HTMLInputElement) return

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
			on(next, 'click', () => {
				host.value++
				if (host.value >= host.max) prev.focus()
			}),
			watch('value', value => {
				host.setAttribute('value', String(value))
				input.value = String(value)
				prev.disabled = value <= 1
			}),
			watch('max', max => {
				host.hidden = max <= 1
				host.setAttribute('max', String(max))
				input.max = String(max)
			}),
			watch(['value', 'max'], ([value, max]) => {
				next.disabled = value >= max
			}),
			valueEl && watch('value', bindText(valueEl)),
			maxEl && watch('max', bindText(maxEl)),
		]
	},
)
