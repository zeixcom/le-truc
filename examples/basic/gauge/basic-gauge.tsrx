/**
 * Isomorphic-format migration: basic-gauge (LT-115 cutover) — composes
 * `basic-number.tsrx` (ADR 0024 sub-design 10) and derives a threshold
 * `qualification` (label + color) reactively from `value` and a JSON
 * `thresholds` arg via `deriveCell`. The root's reactive
 * `style={() => ({ … })}` lowers to one `watch(thunk, bindStyle(host, keys))`
 * call (LT-028), so the ring's color and rotation stay live when `value`
 * changes after connect — parity with the hand-written `basic-gauge.ts`.
 *
 * Contract notes (restored to the hand-written twin verbatim, per the
 * TSRX-HOST-PROFILE data account — LT-115, closing the LT-092 stop):
 * - `value` is Parser-exposed with the inner `<meter>`'s own value as the
 *   fallback (`asNumber(meter.value)`), so markup that only sets the value on
 *   the meter — the demo page's shape — still seeds the prop (children are
 *   data; the host attribute stays a legitimate override).
 * - `observedAttributes(['value'])` re-parses the `value` attribute on every
 *   post-connect mutation — the runtime path frameworks that write attributes
 *   instead of properties need (gauge spec: "re-parses the value attribute
 *   when it mutates at runtime").
 * - The meter's `value={() => host.value}` mirror lowers to
 *   `watch(() => host.value, bindProperty(meter, 'value'))` — the twin's own
 *   line, keeping the accessible meter in sync with the prop.
 * - LT-115's compiler fix is what makes `qualification` live: the client's
 *   substituted body reads `host.value` (the exposed prop's Slot — a tracked
 *   reactive source) instead of the untracked `getAttribute('value')` that
 *   froze the ring and label after connect. `thresholds` stays an
 *   `host.getAttribute('thresholds')` read — read-once data, like the twin.
 */

export type BasicGaugeProps = {
	/**
	 * Current gauge value in the range [0, 1]. Read from the `value`
	 * attribute at connect time (falling back to the inner `<meter>`'s value
	 * for markup that only sets it there), and re-parsed on later `value`
	 * attribute mutations — e.g. from frameworks like React that set DOM
	 * attributes rather than properties.
	 */
	value: number
}

export type BasicGaugeThreshold = {
	min: number
	label: string
	color: string
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-gauge': HTMLElement & BasicGaugeProps
	}
}

import { asNumber, deriveCell } from '@zeix/le-truc'
import { BasicNumber } from '../number/basic-number.tsrx'

export const config = { observedAttributes: ['value'] }

/**
 * A gauge that displays a numeric value as a meter with color-coded thresholds.
 * Use it for visualising a value within a known range — the needle rotates
 * to reflect the current value and the color indicates which threshold applies.
 * The `value` must be a number within the range defined by the thresholds.
 * Thresholds should be ordered by `min` value for correct color assignment.
 * The `value` attribute is observed post-connect, so setting it at runtime
 * (e.g. `gauge.setAttribute('value', '0.5')`) updates the gauge too, not just
 * the initial `value` property.
 *
 * @attribute {BasicGaugeThreshold[]} thresholds - Color-coded thresholds as a JSON array, e.g. `[{"min":0,"label":"Low","color":"red"}]`. Defaults to an empty array (no color/label applied) if omitted. Read once at connect time.
 * @cssprop --basic-gauge-background - Background color behind the ring. Defaults to `--color-background`.
 * @cssprop --basic-gauge-label-color - Text color of the qualification label. Defaults to `--color-text-soft`.
 * @cssprop --basic-gauge-label-font-size - Font size of the qualification label. Defaults to `--font-size-s`.
 * @cssprop --basic-gauge-metric-color - Text color of the numeric value. Defaults to `--color-text`.
 * @cssprop --basic-gauge-metric-font-size - Font size of the numeric value. Defaults to `--font-size-xl`.
 * @cssprop --basic-gauge-ring-width - Ring thickness. Accepts any CSS length; defaults to `--space-xs`.
 * @cssprop --basic-gauge-size - Overall gauge diameter. Accepts any CSS length; defaults to `8rem`.
 * @cssprop --basic-gauge-track-color - Background color of the unfilled ring track. Defaults to `--color-secondary`.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-gauge} Interactive preview and usage examples
 **/
export function BasicGauge(
	{
		value,
		label = 'Value:',
		thresholds = '[]',
	}: { value: number; label?: string; thresholds?: string },
)
	@{
		const meter = first(
			'meter',
			'a <meter> element for the accessible level fallback',
		)

		const qualification = deriveCell(() => {
			const parsed = JSON.parse(thresholds);
			const found = parsed.find(
				(t: BasicGaugeThreshold) => Number(value) >= t.min,
			) ?? {
				label: '',
				color: 'var(--color-primary)',
			};
			return { ...found, degree: `${240 * Number(value)}deg` };
		});

		expose({ value: asNumber(meter.value) });

		<>
			<basic-gauge
				{value}
				{thresholds}
				style={() => ({
					'--basic-gauge-color': qualification.get().color,
					'--basic-gauge-degree': qualification.get().degree,
				})}
			>
				<p id="basic-gauge-label">{label}</p>
				<meter
					class="visually-hidden"
					value={() => host.value}
					aria-labelledby="basic-gauge-label"
				></meter>
				<BasicNumber
					{value}
					options={'{"style":"percent","maximumFractionDigits":1}'}
					ref={numberEl}
					truc:pass={{ value: () => host.value }}
				/>
				<small class="label">{qualification.get().label}</small>
			</basic-gauge>

			<style>
			basic-gauge {
				--basic-gauge-background: var(--color-background, light-dark(#ecebef, #242326));
				--basic-gauge-label-color: var(--color-text-soft, light-dark(#46444a, #d8d6dd));
				--basic-gauge-label-font-size: var(--font-size-s, 0.875rem);
				--basic-gauge-metric-color: var(--color-text, light-dark(#242326, #ecebef));
				--basic-gauge-metric-font-size: var(--font-size-xl, 1.3125rem);
				--basic-gauge-ring-width: var(--space-xs, 0.382rem);
				--basic-gauge-size: 8rem;
				--basic-gauge-track-color: var(--color-secondary, light-dark(#d8d6dd, #46444a));

				width: var(--basic-gauge-size);
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
				aspect-ratio: 1;
				background-image:
					radial-gradient(
						closest-side,
						var(--basic-gauge-background) 0%,
						var(--basic-gauge-background) calc(100% - var(--basic-gauge-ring-width)),
						transparent calc(100% - var(--basic-gauge-ring-width))
					),
					conic-gradient(
						from -120deg,
						var(--basic-gauge-color) 0deg var(--basic-gauge-degree),
						transparent var(--basic-gauge-degree) 240deg
					),
					conic-gradient(
						from -120deg,
						var(--basic-gauge-track-color) 0deg 240deg,
						transparent 240deg
					);
				border-radius: 50%;

				& p {
					display: inline-block;
					color: var(--basic-gauge-label-color);
					font-size: var(--basic-gauge-label-font-size);
					margin: 0;
				}

				& basic-number {
					display: inline-block;
					color: var(--basic-gauge-metric-color);
					font-size: var(--basic-gauge-metric-font-size);
				}

				.label {
					display: inline-block;
					font-size: var(--basic-gauge-label-font-size);
					color: var(--basic-gauge-label-color);
				}
			}
			</style>
		</>
	}
