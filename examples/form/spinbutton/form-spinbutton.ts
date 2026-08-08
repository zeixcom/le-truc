import {
	asNumber,
	bindProperty,
	bindText,
	bindVisible,
	createMemo,
	defineComponent,
	defineMethod,
	type FormAssociatedElement,
	formAssociated,
	relayValidity,
} from '../../..'

export type FormSpinbuttonProps = {
	/** Current numeric value. Clamped to [min, max]. */
	value: number
	/** Lower bound for the value. Read from `input.min`, may be negative. */
	min: number
	/** Upper bound for the value. Read from `input.max`. */
	max: number
	/** Decrements value by a step, clamped to `min`. `big` uses the big-step instead of step. */
	stepDown: (big?: boolean) => void
	/** Increments value by a step, clamped to `max`. `big` uses the big-step instead of step. */
	stepUp: (big?: boolean) => void
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
 * Step size is read from the host's `step` attribute (falling back to the
 * nested `input.step`, default `1`); a fractional step (e.g. `step="0.1"`)
 * switches the whole component to floating-point mode, so `value`/`min`/`max`
 * are parsed and rounded as decimals instead of integers. An optional
 * `big-step` attribute (default `step * 10`) sets the increment used when
 * Shift is held (on Arrow keys or button clicks) or `stepDown(true)`/
 * `stepUp(true)` is called. `min` is no
 * longer fixed at `0` — negative ranges work, and typing `-`/`+` directly
 * into a focused input is left to the browser rather than intercepted as a
 * step shortcut (only Arrow keys and clicks on the buttons step by `±1`
 * character). Form participation and range validation are via ElementInternals
 * (`formAssociated()`, `setFormValue`, `relayValidity`). Exposes
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

		const rawStep = asNumber(1)(host.getAttribute('step') ?? input.step)
		// Zero/negative steps would divide-by-zero or reverse +/- direction in stepBy
		const step = rawStep > 0 ? rawStep : 1
		const isInteger = Number.isInteger(step)
		const rawBigStep = asNumber(step * 10)(host.getAttribute('big-step'))
		const bigStep = rawBigStep > 0 ? rawBigStep : step * 10
		const decimals = isInteger ? 0 : (String(step).split('.')[1] ?? '').length
		const clamp = (value: number) =>
			Math.min(maxValue, Math.max(minValue, value))
		const roundToStep = (value: number) => {
			const clamped = clamp(Math.round(value / step) * step)
			return isInteger ? clamped : Number(clamped.toFixed(decimals))
		}

		const parseValue = (raw: string | null) => {
			if (raw == null) return undefined
			const parsed = isInteger ? Number.parseInt(raw) : Number.parseFloat(raw)
			return Number.isFinite(parsed) ? parsed : undefined
		}
		// Host attribute wins over the nested input's own attribute (e.g.
		// form-colorgraph sets min/max/step on the host per axis, leaving its
		// input bare); falls back further to an unbounded default.
		// Bounds are resolved once, up front, so `value`'s fallback/clamp can
		// use them directly — reading host.min/host.max here instead would see
		// undefined, since those accessors aren't installed until the expose()
		// call below processes them.
		const fromHostOrInput = (attr: 'value' | 'min' | 'max') =>
			parseValue(host.getAttribute(attr)) ?? parseValue(input[attr])
		const minValue =
			fromHostOrInput('min') ??
			(isInteger ? Number.MIN_SAFE_INTEGER : Number.MIN_VALUE)
		const maxValue =
			fromHostOrInput('max') ??
			(isInteger ? Number.MAX_SAFE_INTEGER : Number.MAX_VALUE)

		expose({
			value: clamp(fromHostOrInput('value') ?? minValue),
			max: maxValue,
			min: minValue,
			stepDown: defineMethod((big = false) => stepBy(-1, big)),
			stepUp: defineMethod((big = false) => stepBy(1, big)),
		})

		// host.value's watch (below) already relays validity synchronously as
		// part of this assignment — effects run synchronously on write in this
		// library, so checkValidity() here already sees the up-to-date state.
		const commit = (value: number) => {
			const prev = host.value
			host.value = value
			if (host.checkValidity())
				host.dispatchEvent(new Event('change', { bubbles: true }))
			else host.value = prev
		}

		const stepBy = (direction: 1 | -1, big = false) => {
			const delta = (big ? bigStep : step) * direction
			const clamped = roundToStep((input.valueAsNumber || 0) + delta)
			input.value = String(clamped)
			commit(clamped)
		}

		on(input, 'change', () => {
			const next = input.valueAsNumber
			// Reject invalid, non-integer (in integer mode), or unsafely large
			// values outright — revert to the last committed value.
			const rejected =
				!Number.isFinite(next) ||
				(isInteger &&
					(!Number.isInteger(next) || Math.abs(next) > Number.MAX_SAFE_INTEGER))
			// Clamp rather than reject out-of-range values
			const value = rejected
				? host.value
				: Math.min(host.max, Math.max(host.min, next))
			input.value = String(value)
			commit(value)
		})

		// Form value sync: managed (value → setFormValue via ElementInternals)
		// Form reset: managed (value attribute is the default)
		watch(
			() => ({ value: host.value, min: host.min, max: host.max }),
			({ value, min, max }) => {
				input.value = String(value)
				input.min = String(min)
				input.max = String(max)
				relayValidity(internals, input)
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
		on(decrement, 'click', ({ shiftKey }) => stepBy(-1, shiftKey))
		on(increment, 'click', ({ shiftKey }) => stepBy(1, shiftKey))
		on(host, 'keydown', event => {
			const { key, shiftKey, target } = event
			if (!['ArrowUp', 'ArrowDown', '+', '-'].includes(key)) return
			if ((key === '+' || key === '-') && target === input) return
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

		// Zero-state visual treatment is opt-in via `.zero`
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
