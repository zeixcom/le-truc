/**
 * Isomorphic-format migration: basic-gauge — composes `basic-number.tsrx`
 * (ADR 0024 sub-design 10) and derives a threshold `qualification` (label +
 * color) reactively from `value` and a JSON `thresholds` arg via
 * `deriveCell` + the widened arg→DOM-site substitution (sub-design 12). The
 * root's reactive `style={() => ({ … })}` lowers to one
 * `watch(thunk, bindStyle(host, keys))` call (LT-028), so the ring's color
 * and rotation stay live when `value` changes after connect — parity with
 * the hand-written `basic-gauge.ts`.
 */
export type BasicGaugeProps = {
	/** Current gauge value in the range [0, 1]. */
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

import { BasicNumber } from '../number/basic-number.tsrx'

/**
 * A gauge that displays a numeric value as a meter with color-coded thresholds.
 * Use it for visualising a value within a known range — the needle rotates
 * to reflect the current value and the color indicates which threshold applies.
 *
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
		const qualification = deriveCell(() => {
			const parsed = JSON.parse(thresholds);
			const found = parsed.find((t: BasicGaugeThreshold) => Number(value) >= t.min) ?? {
				label: '',
				color: 'var(--color-primary)',
			};
			return { ...found, degree: `${240 * Number(value)}deg` };
		});

		expose({ value: asNumber() });

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
				<meter class="visually-hidden" {value} aria-labelledby="basic-gauge-label"></meter>
				<BasicNumber
					{value}
					options={'{"style":"percent","maximumFractionDigits":1}'}
					ref={numberEl}
					pass={{ value: () => host.value }}
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
