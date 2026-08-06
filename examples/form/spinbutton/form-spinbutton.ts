import {
	asClampedInteger,
	asInteger,
	asNumber,
	bindProperty,
	bindText,
	bindVisible,
	createMemo,
	defineComponent,
	defineMethod,
	delegateValidity,
	type FormAssociatedElement,
	formAssociated,
} from '../../..'

export type FormSpinbuttonProps = {
	/** Current numeric value. Clamped to [min, max]. */
	value: number
	/** Lower bound for the value. */
	min: number
	/** Upper bound for the value. */
	max: number
	/** Decrements value by `step` (default 1), clamped to `min`. */
	stepDown: (step?: number) => void
	/** Increments value by `step` (default 1), clamped to `max`. */
	stepUp: (step?: number) => void
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
 * Form participation and range validation are via ElementInternals
 * (`formAssociated()`, `setFormValue`, `delegateValidity`). Exposes
 * `stepDown`/`stepUp` methods (clamped to `min`/`max`) so other components can
 * drive the value without duplicating the clamp logic. An optional `.error`
 * descendant, if present, shows `host.validationMessage` — whichever of the
 * range constraint or an externally-set `customError` currently applies (see
 * `module-catalog.ts` for a composed example: a stock-availability check that
 * sets both). A required `fieldset` descendant wraps the interactive
 * controls: native `disabled` cascade to all of them when `host.disabled` is
 * set, without per-element wiring. An optional `.zero` descendant opts into
 * hiding the input/decrement button and swapping the increment label at
 * `value === 0` (e.g. a "Add to Cart" affordance) — without it, this is a
 * plain generic spinbutton.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-spinbutton} Interactive preview and usage examples
 **/
export default defineComponent<FormSpinbuttonProps>(
	'form-spinbutton',
	({ expose, first, host, internals, on, watch }) => {
		const input = first('input', 'Add a native input to display the value')

		const step = asNumber(1)(host.getAttribute('step') ?? input.step)
		const isInteger = Number.isInteger(step)
		const bigStep = asNumber(step * 10)(host.getAttribute('big-step'))
		const fromInput = (attr: 'value' | 'min' | 'max') => {
			const parsed = isInteger ? Number.parseInt(input[attr]) : Number.parseFloat(input[attr])
			return Number.isFinite(parsed) ? parsed : undefined
		}

		expose({
			value: isInteger
				? asClampedInteger(fromInput('value') ?? host.min, host.max)
				: asNumber(fromInput('value') ?? host.min),
			max: isInteger
				? asInteger(fromInput('max') ?? Number.MAX_SAFE_INTEGER)
				: asNumber(fromInput('max') ?? Number.MAX_VALUE),
			min: isInteger
				? asInteger(fromInput('min') ?? Number.MIN_SAFE_INTEGER)
				: asNumber(fromInput('min') ?? Number.MIN_VALUE),
			stepDown: defineMethod((big = false) => stepBy(-1, big)),
			stepUp: defineMethod((big = false) => stepBy(1, big)),
		})

		const commit = (value: number) => {
			const prev = host.value
			host.value = value
			if (internals) delegateValidity(internals, input)
			if (host.checkValidity()) host.dispatchEvent(new Event('change', { bubbles: true }))
			else host.value = prev
		}

		const stepBy = (direction: 1 | -1, big = false) => {
			const delta = (big ? bigStep : step) * direction
			const current = input.valueAsNumber || 0
			const nearest = Math.round((current + delta) / step) * step
			const clamped = Math.min(host.max, Math.max(host.min, nearest))
			input.value = String(clamped)
			commit(clamped)
		}

		on(input, 'change', () => {
			let next = input.valueAsNumber
			// Ignore invalid values or out-of-range integers
			if (
				!Number.isFinite(next)
				|| (isInteger && Math.abs(next) > Number.MAX_SAFE_INTEGER)
			)
				next = host.value
			commit(next)
		})

		// Form value sync: managed (value → setFormValue via ElementInternals)
		// Form reset: managed (value attribute is the default)
		watch(
			() => ({ value: host.value, min: host.min, max: host.max }),
			({ value, min, max }) => {
				input.value = String(value)
				input.min = String(min)
				input.max = String(max)
				if (internals) {
					delegateValidity(internals, input)
					host.setCustomValidity('')
				}
			},
		)

		const decrement = first(
			'button.decrement',
			'Add a native button to decrement the value',
		)
		const increment = first(
			'button.increment',
			'Add a native button to increment the value',
		)
		on(decrement, 'click', () => stepBy(-1, false))
		on(increment, 'click', () => stepBy(1, false))
		on(host, 'keydown', event => {
			const { key, shiftKey } = event
			if (!['ArrowUp', 'ArrowDown', '+', '-'].includes(key)) return
			event.preventDefault()
			event.stopPropagation()
			stepBy(key === 'ArrowDown' || key === '-' ? -1 : 1, shiftKey)
		})
		watch(() => host.value >= host.max, bindProperty(increment, 'disabled'))
		watch(() => host.value <= host.min, bindProperty(decrement, 'disabled'))

		const fieldset = first(
			'fieldset',
			'Wrap the interactive controls in a fieldset so host.disabled cascades to them natively',
		)
		watch('disabled', bindProperty(fieldset, 'disabled'))

		const errorEl = first('.error')
		if (errorEl) watch('validationMessage', bindText(errorEl))

		// Zero-state visual treatment is opt-in via `.zero` — a plain reusable
		// spinbutton (e.g. driven purely through stepDown()/stepUp() by a host
		// component) has no reason to special-case value === 0.
		const zero = first('.zero')
		if (zero) {
			const nonZero = createMemo(() => host.value !== 0)
			watch(nonZero, nz => {
				input.hidden = !nz
				decrement.hidden = !nz
			})

			const incrementLabel = increment.ariaLabel || 'Increment'
			watch(nonZero, nz => {
				zero.hidden = nz
				increment.ariaLabel = nz ? incrementLabel : zero.textContent
			})

			const other = first('.other')
			if (other) watch(nonZero, bindVisible(other))
		}
	},
	[formAssociated()],
)
