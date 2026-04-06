import { createMemo, defineComponent } from '../../..'

export type FormSpinbuttonProps = {
	value: number
	max: number
}

declare global {
	interface HTMLElementTagNameMap {
		'form-spinbutton': HTMLElement & FormSpinbuttonProps
	}
}

export default defineComponent<FormSpinbuttonProps>(
	'form-spinbutton',
	({ all, expose, first, host, on, watch }) => {
		const controls = all('button, input:not([disabled])')
		const increment = first(
			'button.increment',
			'Add a native button to increment the value',
		)
		const decrement = first(
			'button.decrement',
			'Add a native button to decrement the value',
		)
		const input = first(
			'input.value',
			'Add a native input to display the value',
		)
		const zero = first('.zero')
		const other = first('.other')

		const nonZero = createMemo(() => host.value !== 0)
		const incrementLabel = increment.ariaLabel || 'Increment'
		const ariaLabel = createMemo(() =>
			nonZero.get() || !zero ? incrementLabel : zero.textContent,
		)

		expose({
			value: parseInt(input.value, 10) || 0,
			max: parseInt(input.max, 10) || 10,
		})

		return [
			on(controls, 'change', (_e, target) => {
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
			on(controls, 'click', (_e, el) => {
				if (el.classList.contains('decrement')) {
					host.value = Math.max(0, host.value - 1)
				} else if (el.classList.contains('increment')) {
					host.value = Math.min(host.max, host.value + 1)
				}
			}),
			on(controls, 'keydown', (e, _el) => {
				const { key } = e as KeyboardEvent
				if (['ArrowUp', 'ArrowDown', '-', '+'].includes(key)) {
					e.stopPropagation()
					e.preventDefault()
					const delta = key === 'ArrowDown' || key === '-' ? -1 : 1
					host.value = Math.min(host.max, Math.max(0, host.value + delta))
				}
			}),
			watch(nonZero, nz => {
				input.hidden = !nz
				decrement.hidden = !nz
			}),
			watch('value', v => {
				input.value = String(v)
			}),
			watch('max', m => {
				input.max = String(m)
			}),
			watch(['value', 'max'], () => {
				increment.disabled = host.value >= host.max
			}),
			watch(ariaLabel, label => {
				increment.ariaLabel = label || null
			}),
			zero
				&& watch(nonZero, nz => {
					zero.hidden = nz
				}),
			other
				&& watch(nonZero, nz => {
					other.hidden = !nz
				}),
		]
	},
)
