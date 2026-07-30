import {
	bindProperty,
	bindVisible,
	createMemo,
	defineComponent,
	type FormAssociatedElement,
	formAssociated,
} from '../../..'

export type FormSpinbuttonProps = {
	/** Current numeric value. Clamped to [0, max]. */
	value: number
	/** Upper bound for the value. */
	max: number
}

declare global {
	interface HTMLElementTagNameMap {
		'form-spinbutton': FormAssociatedElement & FormSpinbuttonProps
	}
}

/**
 * A numeric spinbutton with increment/decrement buttons and keyboard support.
 * Use it for numeric input within a bounded range — provides ARIA spinbutton
 * semantics and Arrow key support for incrementing and decrementing the value.
 * Form participation and range validation are via ElementInternals (`formAssociated()`,
 * `setFormValue`, `setValidity`).
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-spinbutton} Interactive preview and usage examples
 **/
export default defineComponent<FormSpinbuttonProps>(
	'form-spinbutton',
	({ all, expose, first, host, internals, on, watch }) => {
		const input = first(
			'input.value',
			'Add a native input to display the value',
		)

		expose({
			value: Number.parseInt(input.value) || 0,
			max: Number.parseInt(input.max) || 10,
		})

		const controls = all('button, input:not([disabled])')
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
		})
		on(controls, 'click', (_e, el) => {
			if (el.classList.contains('decrement'))
				host.value = Math.max(0, host.value - 1)
			else if (el.classList.contains('increment'))
				host.value = Math.min(host.max, host.value + 1)
		})
		on(controls, 'keydown', e => {
			const { key } = e as KeyboardEvent
			if (['ArrowUp', 'ArrowDown', '-', '+'].includes(key)) {
				e.stopPropagation()
				e.preventDefault()
				const delta = key === 'ArrowDown' || key === '-' ? -1 : 1
				host.value = Math.min(host.max, Math.max(0, host.value + delta))
			}
		})

		const decrement = first(
			'button.decrement',
			'Add a native button to decrement the value',
		)
		const nonZero = createMemo(() => host.value !== 0)
		watch(nonZero, nz => {
			input.hidden = !nz
			decrement.hidden = !nz
		})

		const zero = first('.zero')
		const increment = first(
			'button.increment',
			'Add a native button to increment the value',
		)
		const incrementLabel = increment.ariaLabel || 'Increment'
		if (zero)
			watch(nonZero, nz => {
				zero.hidden = nz
				increment.ariaLabel = nz ? incrementLabel : zero.textContent
			})

		const other = first('.other')
		if (other) watch(nonZero, bindVisible(other))

		watch(() => String(host.value), bindProperty(input, 'value'))
		watch(() => String(host.max), bindProperty(input, 'max'))
		watch(() => host.value >= host.max, bindProperty(increment, 'disabled'))
		// Form value sync: managed (value → setFormValue via ElementInternals)
		// Form reset: managed (value attribute is the default)
		// Typed validity flags — the one legitimate direct-internals use
		// among the form examples (rangeOverflow / rangeUnderflow).
		watch(
			() => ({ value: host.value, max: host.max }),
			({ value, max }) => {
				const overflow = value > max
				const underflow = value < 0
				internals?.setValidity(
					{
						rangeOverflow: overflow,
						rangeUnderflow: underflow,
					},
					overflow
						? `Value must be ${max} or less`
						: underflow
							? 'Value must be 0 or greater'
							: '',
				)
			},
		)
	},
	[formAssociated()],
)
