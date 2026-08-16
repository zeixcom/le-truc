import {
	asJSON,
	asNumber,
	defineComponent,
	observedAttributes,
} from '../../../index'

export type BasicGaugeProps = {
	/**
	 * Current gauge value in the range [0, meter.max]. Read from the `value`
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
export default defineComponent<BasicGaugeProps>(
	'basic-gauge',
	({ expose, first, host, pass, watch }) => {
		const meter = first('meter', 'Add a <meter> element to display the level')

		expose({ value: asNumber(meter.value) })

		const thresholds = asJSON<BasicGaugeThreshold[]>([])(
			host.getAttribute('thresholds'),
		)

		const valueEl = first(
			'basic-number',
			'Add a <basic-number> element to display the value',
		)
		pass(valueEl, { value: () => host.value })

		watch('value', value => {
			meter.value = value
			host.style.setProperty(
				'--basic-gauge-degree',
				`${(240 * value) / meter.max}deg`,
			)
		})

		const labelEl = first(
			'.label',
			'Add an element to display the qualification label',
		)
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
		)
	},
	[observedAttributes(['value'])],
)
