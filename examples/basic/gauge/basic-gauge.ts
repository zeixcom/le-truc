import { asJSON, defineComponent } from '../../..'

export type BasicGaugeProps = {
	/** Current gauge value in the range [0, meter.max]. */
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

/**
 * A gauge that displays a numeric value as a meter with color-coded thresholds.
 * Thresholds are read from the `thresholds` attribute as a JSON array.
 * @cssprop --basic-gauge-degree - Rotation angle of the gauge needle (set reactively).
 * @cssprop --basic-gauge-color - Active threshold color (set reactively).
 */
export default defineComponent<BasicGaugeProps>(
	'basic-gauge',
	({ expose, first, host, pass, watch }) => {
		const meter = first('meter', 'Add a <meter> element to display the level')
		const valueEl = first(
			'basic-number',
			'Add a <basic-number> element to display the value',
		)
		const labelEl = first(
			'.label',
			'Add an element to display the qualification label',
		)

		expose({ value: meter.value })

		const thresholds = asJSON<BasicGaugeThreshold[]>([])(
			host.getAttribute('thresholds'),
		)

		return [
			pass(valueEl, { value: () => host.value }),

			watch('value', value => {
				meter.value = value
				host.style.setProperty(
					'--basic-gauge-degree',
					`${(240 * value) / meter.max}deg`,
				)
			}),
			watch(
				() =>
					thresholds.find(threshold => host.value >= threshold.min) || {
						label: '',
						color: 'var(--color-primary)',
					},
				qualification => {
					labelEl.textContent = qualification.label
					host.style.setProperty('--basic-gauge-color', qualification.color)
				},
			),
		]
	},
)
