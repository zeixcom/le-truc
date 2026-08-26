/**
 * TSRX migration: form-spinbutton — the hand-written version is a light-DOM
 * enhancer over up to 8 structurally different demo markups (optional
 * `.error`, `.zero`/`.other` zero-state affordance, optional `<label>`,
 * fractional-step float mode). This migration owns a single canonical
 * template driven by typed props (`min`/`max`/`step`/`bigStep`/`unit`/
 * `label`) instead of DOM-harvested optional descendants — the same
 * category of change as `form-checkbox`/`form-textbox`'s prior migrations.
 * The `.zero`/`.other` "Add to Cart"-style affordance (swap the whole
 * input/decrement for a single call-to-action button at `value === 0`,
 * used by `module-catalog.ts`) is DROPPED here: it needs the decrement
 * button and the increment button's own text to trade places depending on
 * a value comparison, and `@if`/`@else`'s union addressing requires
 * identical construct text across both branch roots — a structural
 * swap like this doesn't fit that contract. Left as a follow-up if a
 * second component needs it (worth a dedicated design then, not a
 * workaround here).
 *
 * `stepBy`'s clamp/commit logic isn't a shared plain setup const (a plain
 * const referencing `host`/refs breaks server compilation once emitted
 * verbatim there — found migrating form-inplace-edit.tsrx) — it lives
 * directly in the `stepDown`/`stepUp` `defineMethod` bodies instead
 * (`expose()`'s object literal gets `host`/ref shims auto-generated
 * server-side, same mechanism form-textbox.tsrx's `clear` method already
 * relies on). Every other call site (button clicks, Arrow keys) just calls
 * the exposed `host.stepDown()`/`host.stepUp()`, instead of duplicating the
 * clamp math.
 *
 * `step`/`bigStep` are exposed props (not just plain setup consts derived
 * from the args) for the same reason: the generated CLIENT factory never
 * receives the original render args at all (only `host`/`internals`/refs/
 * signals) — a plain const like `Number.isInteger(step)` referencing the
 * raw `step` arg is fine server-side but fails client-side with "cannot
 * find name" wherever it's needed (inside `stepDown`/`stepUp`, which run
 * purely client-side). Reading `host.step`/`host.bigStep` instead works on
 * both sides via the same host shim.
 *
 * `value`/`min`/`max={() => String(host.x)}` on the native `<input>` can't
 * be bare `() => host.x` host-prop mirrors (the dispatch the compiler
 * reserves for exact `host.prop` thunks, lowering to `bindProperty` —
 * `hostPropOf` requires the thunk body to be nothing but the member
 * expression): `host.value`/`min`/`max` are `number`-typed exposed props,
 * but `HTMLInputElement`'s `value`/`min`/`max` are `string`-typed DOM
 * properties, so `bindProperty(input, 'value')` fed a number-returning
 * thunk fails to type-check. Wrapping in `String(...)` disqualifies the
 * mirror match and falls back to `bindAttribute` instead — fine for
 * `min`/`max` (no "dirty" attribute/property divergence for those), but
 * `value` has the same native dirty-value-flag caveat noted for `checked`
 * in the LT-037 NOTES.md entry: once the user (or a prior JS write to
 * `.value`) has touched the input, later `setAttribute('value', …)` calls
 * may not resync the live value in every browser. `stepDown`/`stepUp`/the
 * input's own `onChange` already write `input.value` directly on every
 * host-value change they cause, so this only matters for `host.value`
 * being set from OUTSIDE the component.
 */
import { relayValidity } from '../../../index'

export const config = { formAssociated: true }

export type FormSpinbuttonProps = {
	/** Current numeric value. Clamped to [min, max]. */
	value: number
	/** Lower bound for the value. */
	min: number
	/** Upper bound for the value. */
	max: number
	/** Step size. A fractional value switches value/min/max to decimal rounding. */
	step: number
	/** Increment used when Shift is held on Arrow keys or button clicks. */
	bigStep: number
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
 * A fractional `step` (e.g. `step={0.5}`) switches value/min/max parsing and
 * rounding to decimals instead of integers. `bigStep` (default `step * 10`)
 * sets the increment used when Shift is held on Arrow keys or button clicks.
 * Form participation and range validation are via ElementInternals
 * (`formAssociated()`, `relayValidity`).
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-spinbutton} Interactive preview and usage examples
 **/
export function FormSpinbutton(
	{
		name,
		label,
		value = 0,
		min = 0,
		max = 100,
		step = 1,
		bigStep,
		unit,
	}:
		{
			name: string
			label?: string
			value?: number
			min?: number
			max?: number
			step?: number
			bigStep?: number
			unit?: string
		},
)
@{
	const inputId = `${name}-input`

	expose({
		value: asNumber(0),
		min: asNumber(0),
		max: asNumber(100),
		step: asNumber(1),
		bigStep: asNumber(10),
		stepDown: defineMethod((big = false) => {
			const isInteger = Number.isInteger(host.step)
			const decimals = isInteger ? 0 : (String(host.step).split('.')[1] ?? '').length
			const delta = big ? host.bigStep : host.step
			const clamped = Math.min(
				host.max,
				Math.max(
					host.min,
					Math.round(((input.valueAsNumber || 0) - delta) / host.step) * host.step,
				),
			)
			const rounded = isInteger ? clamped : Number(clamped.toFixed(decimals))
			input.value = String(rounded)
			const prev = host.value
			host.value = rounded
			if (host.checkValidity())
				host.dispatchEvent(new Event('change', { bubbles: true }))
			else host.value = prev
			relayValidity(internals, input)
		}),
		stepUp: defineMethod((big = false) => {
			const isInteger = Number.isInteger(host.step)
			const decimals = isInteger ? 0 : (String(host.step).split('.')[1] ?? '').length
			const delta = big ? host.bigStep : host.step
			const clamped = Math.min(
				host.max,
				Math.max(
					host.min,
					Math.round(((input.valueAsNumber || 0) + delta) / host.step) * host.step,
				),
			)
			const rounded = isInteger ? clamped : Number(clamped.toFixed(decimals))
			input.value = String(rounded)
			const prev = host.value
			host.value = rounded
			if (host.checkValidity())
				host.dispatchEvent(new Event('change', { bubbles: true }))
			else host.value = prev
			relayValidity(internals, input)
		}),
	})

	<>
		<form-spinbutton
			{name}
			{value}
			min={min}
			max={max}
			step={step}
			bigStep={bigStep ?? step * 10}
		>
			@if (label) {
				<label for={inputId}>{label}</label>
			}
			<fieldset
				disabled={() => host.disabled}
				onKeydown={(e: KeyboardEvent) => {
					const { key, shiftKey, target } = e
					if (!['ArrowUp', 'ArrowDown', '+', '-'].includes(key)) return
					if ((key === '+' || key === '-') && target === input) return
					e.preventDefault()
					e.stopPropagation()
					if (key === 'ArrowDown' || key === '-') host.stepDown(shiftKey)
					else host.stepUp(shiftKey)
				}}
			>
				<div class="input">
					<button
						type="button"
						class="decrement"
						aria-label="Decrement"
						disabled={() => host.value <= host.min}
						onClick={(e: MouseEvent) => host.stepDown(e.shiftKey)}
					>−</button>
					<input
						id={inputId}
						type="number"
						ref={input}
						value={() => String(host.value)}
						min={() => String(host.min)}
						max={() => String(host.max)}
						step={Number.isInteger(step) ? '1' : 'any'}
						onChange={() => {
							const isInteger = Number.isInteger(host.step)
							const next = input.valueAsNumber
							const rejected =
								!Number.isFinite(next) ||
								(isInteger &&
									(!Number.isInteger(next) || Math.abs(next) > Number.MAX_SAFE_INTEGER))
							const committed = rejected
								? host.value
								: Math.min(host.max, Math.max(host.min, next))
							input.value = String(committed)
							const prev = host.value
							host.value = committed
							if (host.checkValidity())
								host.dispatchEvent(new Event('change', { bubbles: true }))
							else host.value = prev
							relayValidity(internals, input)
						}}
					/>
					@if (unit) {
						<span class="unit">{unit}</span>
					}
					<button
						type="button"
						class="increment"
						aria-label="Increment"
						disabled={() => host.value >= host.max}
						onClick={(e: MouseEvent) => host.stepUp(e.shiftKey)}
					>+</button>
				</div>
			</fieldset>
			<p class="error" role="alert" aria-live="assertive">{host.validationMessage}</p>
		</form-spinbutton>

		<style>
		form-spinbutton {
			--form-spinbutton-min-width: 8rem;
			--form-spinbutton-input-min-width: 4rem;
			--form-spinbutton-input-max-width: 6rem;

			display: inline-flex;
			flex-direction: column;
			align-items: start;

			& label,
			& p,
			& button {
				opacity: var(--opacity-dimmed);
				transition: opacity var(--transition-short) var(--easing-inout);
			}

			& label {
				display: block;
				font-size: var(--font-size-s);
				color: var(--color-text);
				margin-bottom: var(--space-xxs);
			}

			> fieldset {
				all: unset;
				display: inline-flex;
				min-width: var(--form-spinbutton-min-width);

				& input {
					box-sizing: border-box;
					margin: 0;
					border-width: 0;
					border-style: solid;
					border-color: var(--color-border);
					height: var(--input-height);
					min-width: var(--form-spinbutton-input-min-width);
					text-align: center;
					color: var(--color-text);
					background-color: var(--color-input);
					padding: 0 var(--space-xxs);
					flex-grow: 1;
					appearance: textfield;
					-moz-appearance: textfield;

					&:disabled {
						color: var(--color-text-soft);
						background-color: var(--color-background);
						border-color: var(--color-border-soft);
					}

					&::-webkit-outer-spin-button,
					&::-webkit-inner-spin-button {
						-webkit-appearance: none;
						margin: 0;
					}
				}

				> input {
					border-block-width: 1px;
					font-size: var(--font-size-s);
					line-height: 2;
				}

				& button {
					flex-grow: 0;
					box-sizing: border-box;
					height: var(--input-height);
					min-width: var(--input-height);
					border: 1px solid var(--color-border);
					background-color: var(--color-secondary);
					color: var(--color-text);
					padding: 0 var(--space-s);
					font-size: var(--font-size-s);
					line-height: var(--line-height-s);
					white-space: nowrap;
					cursor: pointer;
					transition: all var(--transition-shorter) var(--easing-inout);

					&:disabled {
						opacity: var(--opacity-translucent);
					}

					&:not(:disabled) {
						cursor: pointer;
						opacity: var(--opacity-solid);

						&:hover {
							background-color: var(--color-secondary-hover);
						}

						&:active {
							background-color: var(--color-secondary-active);
						}
					}
				}

				> button {
					&:first-of-type {
						border-radius: var(--space-xs) 0 0 var(--space-xs);
					}

					&:last-of-type {
						border-radius: 0 var(--space-xs) var(--space-xs) 0;
					}
				}

				& *:focus {
					z-index: 1;
				}
			}

			.input {
				display: inline-flex;
				max-width: var(--form-spinbutton-input-max-width);
				align-items: baseline;
				margin-inline-end: var(--space-s);

				& input {
					border-block-end-width: 1px;
					text-align: end;
					margin-inline-end: var(--space-xxs);
					font-size: var(--font-size-m);
					line-height: var(--line-height-s);
				}
			}

			> .error {
				flex-basis: 100%;
				margin: var(--space-xs) 0 0;
				font-size: var(--font-size-xs);
				line-height: var(--line-height-s);
				color: color-mix(in srgb, var(--color-text) 50%, var(--color-error));

				&:empty {
					display: none;
				}
			}

			&:focus-within {
				& label,
				& p,
				& button {
					opacity: var(--opacity-solid);
				}
			}
		}
		</style>
	</>
}
