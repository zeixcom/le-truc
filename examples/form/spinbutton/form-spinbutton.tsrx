/**
 * TSRX migration: form-spinbutton — the hand-written version is a light-DOM
 * enhancer over up to 8 structurally different demo markups (optional
 * `.error`, `.zero`/`.other` zero-state affordance, optional `<label>`,
 * fractional-step float mode). This migration owns a single canonical
 * template driven by typed props (`min`/`max`/`step`/`bigStep`/`unit`/
 * `label`) instead of DOM-harvested optional descendants — the same
 * category of change as `form-checkbox`/`form-textbox`'s prior migrations.
 *
 * The `.zero`/`.other` "Add to Cart"-style affordance is RESTORED (LT-118):
 * the `zero` server arg opts in — at `value === 0` the input and the
 * decrement button hide and the increment button shows the call-to-action
 * text (its `.zero` span) with a matching `aria-label`; at any other value
 * the full control set shows and the increment button reads "+" (its
 * `.other` span).
 *
 * It needs NO `@if`/`@else` structural swap, which is what the task
 * originally assumed: the hand-written twin never swapped structures
 * either, it toggled four `hidden` properties over always-present
 * elements. So the spans are a single-branch `@if (zero)` opt-in (already
 * supported) and everything else is a `hidden` fold. `zero` itself is
 * HARVESTED from its own `.zero` span (`zero.textContent`, exactly as the
 * twin read it) rather than parsed from a host attribute: the span is the
 * value's one channel — the arg renders it, the site seeds the prop at
 * connect, LT-122 rebinds it. The `hidden`/`aria-label` thunks read
 * `host.zero`/`host.value` and still render server-side, because LT-118
 * taught `foldableHostProps` that a harvested prop's server truth is the
 * arg that renders its site — without that, following the data account
 * here would have cost three TSRX034 warnings and a real pre-JS flash.
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
 * mirror match — fine for `min`/`max` (no "dirty" attribute/property
 * divergence for those, they stay `bindAttribute`). `value` is covered
 * since LT-116 anyway: a dirty-flag IDL attr on a native form control
 * dispatches as a property write regardless of the thunk's shape, so the
 * `String(host.value)` thunk lowers to `bindProperty(input, 'value')` —
 * an external `host.value` write resyncs the live input text even after
 * the user (or stepUp/stepDown) has set the native dirty-value flag. The
 * `value` ATTRIBUTE stays at the server-rendered default — the reset
 * baseline (LT-057), not a live-value channel.
 */
import { asNumber, defineMethod } from '@zeix/le-truc'
import { relayValidity } from '@zeix/le-truc'

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
		zero,
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
			zero?: string
		},
)
@{
	const inputId = `${name}-input`
	const input = first('input', 'number input')
	// The zero-state affordance is gated on the PRESENCE of its own span,
	// exactly as the hand-written twin gated it (`const zero = first('.zero');
	// if (zero) { … }`) — `zero` is a render-time server arg that decides
	// whether the spans exist, NOT a reactive prop and not part of this
	// component's public interface. Both spans are optional refs (LT-123):
	// they only render when `zero` is set, and a page may author the control
	// by hand without them (module-catalog does).
	const zeroSpan = first('span.zero')
	const otherSpan = first('span.other')

	/**
	 * Commit `next` as the new value: mirror it into the live input, then
	 * write the prop and let the native constraint check veto it — a
	 * rejected value reverts and never fires `change`. Every write path
	 * (both step methods, the input's own `onChange`) ends here, so the
	 * revert-and-relay contract exists once.
	 */
	const commit = (next: number) => {
		input.value = String(next)
		const prev = host.value
		host.value = next
		if (host.checkValidity())
			host.dispatchEvent(new Event('change', { bubbles: true }))
		else host.value = prev
		relayValidity(internals, input)
	}

	/**
	 * The value the user typed, clamped to [min, max] — or the current value
	 * when what they typed cannot be committed at all (not finite, or not a
	 * whole number under an integer step). Unlike `stepBy` this does NOT snap
	 * to the step grid: a fractional step renders `step="any"` on the control
	 * on purpose, so typing more precision than the buttons produce is
	 * allowed (see the `step` attribute below).
	 */
	const typed = () => {
		const next = input.valueAsNumber
		const rejected =
			!Number.isFinite(next) ||
			(Number.isInteger(host.step) &&
				(!Number.isInteger(next) ||
					Math.abs(next) > Number.MAX_SAFE_INTEGER))
		return rejected
			? host.value
			: Math.min(host.max, Math.max(host.min, next))
	}

	/**
	 * Step the current value by `delta`, snapped back onto the step grid and
	 * clamped to [min, max]. `stepDown` is `stepUp` with a negated delta —
	 * the two differed by exactly one character before this was extracted.
	 */
	const stepBy = (delta: number) => {
		const isInteger = Number.isInteger(host.step)
		const decimals = isInteger
			? 0
			: (String(host.step).split('.')[1] ?? '').length
		const clamped = Math.min(
			host.max,
			Math.max(
				host.min,
				Math.round(((input.valueAsNumber || 0) + delta) / host.step) *
					host.step,
			),
		)
		commit(isInteger ? clamped : Number(clamped.toFixed(decimals)))
	}

	expose({
		// Children-are-data (LT-112): each Parser reads the HOST attribute
		// first (its own contract), then falls back to the owned input's
		// attribute, then the plain default — the hand-written twin's exact
		// precedence ("host attribute wins over the nested input's own
		// attribute"). The fallback itself re-parses the input's string so
		// non-numeric values (step="any") degrade to the default instead of
		// NaN. Page authors carry the data on the input; the host attribute
		// stays a legitimate override (form-colorgraph sets per-axis bounds
		// on the composed host).
		value: asNumber(asNumber(0)(input.value)),
		min: asNumber(asNumber(0)(input.min)),
		max: asNumber(asNumber(100)(input.max)),
		step: asNumber(asNumber(1)(input.step)),
		bigStep: asNumber(asNumber(1)(input.step) * 10 || 10),
		stepDown: defineMethod((big = false) => {
			stepBy(-(big ? host.bigStep : host.step))
		}),
		stepUp: defineMethod((big = false) => {
			stepBy(big ? host.bigStep : host.step)
		}),
	})

	// Ported from the hand-written twin (LT-092 cutover): external writes to
	// the exposed bounds/value (e.g. module-catalog lowering `max` after an
	// availability check) must reach the native input AND re-relay validity —
	// the ADR 0020 rangeOverflow+customError composition depends on the relay
	// firing synchronously on the write, BEFORE the composer's
	// setCustomValidity() merges on top. Property writes (not attribute) keep
	// the live input value in sync for controlled usage too.
	watch(
		() => ({ value: host.value, min: host.min, max: host.max }),
		({ value, min, max }) => {
			input.value = String(value)
			input.min = String(min)
			input.max = String(max)
			relayValidity(internals, input)
		},
	)

	<>
		<form-spinbutton
			{name}
			{value}
			{min}
			{max}
			{step}
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
						hidden={() => Boolean(zeroSpan) && host.value === 0}
						disabled={() => host.value <= host.min}
						onClick={(e: MouseEvent) => host.stepDown(e.shiftKey)}
					>−</button>
					<input
						id={inputId}
						type="number"
						class="value"
						value={() => String(host.value)}
						min={() => String(host.min)}
						max={() => String(host.max)}
						// Deliberately NOT the component's own `step` (owner ruling,
						// 2026-08-30 — this is the hand-written twin's twist, and
						// form-colorgraph depends on it): an INTEGER step is enforced
						// natively via `stepMismatch`, which `relayValidity` relays; a
						// FRACTIONAL step renders `any` so the field accepts more
						// precision than `stepUp()`/`stepDown()` themselves produce
						// (colorgraph's chroma axis steps by 0.001 but must accept any
						// oklch value the graph produces). The two channels are the
						// component's step and the CONTROL's step — different things
						// on purpose, not a copy of one value.
						step={Number.isInteger(step) ? '1' : 'any'}
						hidden={() => Boolean(zeroSpan) && host.value === 0}
						onChange={() => commit(typed())}
					/>
					@if (unit) {
						<span class="unit">{unit}</span>
					}
					<button
						type="button"
						class="increment"
						aria-label={() =>
							zeroSpan && host.value === 0
								? (zeroSpan.textContent ?? 'Increment')
								: 'Increment'
						}
						disabled={() => host.value >= host.max}
						onClick={(e: MouseEvent) => host.stepUp(e.shiftKey)}
					>
						@if (zero) {
							<span class="zero" hidden={() => host.value !== 0}>{zero}</span>
						}
						<span
							class="other"
							hidden={() => Boolean(zeroSpan) && host.value === 0}
						>+</span>
					</button>
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
