import {
	asJSON,
	asNumber,
	bindProperty,
	createMemo,
	defineComponent,
} from '../../..'

export type BasicGaugeProps = {
	value: number
	thresholds: BasicGaugeThreshold[]
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

export default defineComponent<BasicGaugeProps>(
	'basic-gauge',
	({ expose, first, host, pass, watch }) => {
		const meter = first('meter', 'Add a <meter> element to display the level')
		const valueEl = first(
			'basic-number',
			'Add a <basic-number> element to display the value',
		)
		const label = first(
			'.label',
			'Add an element to display the qualification label',
		)
		const max = meter.max

		const qualification = createMemo(
			() =>
				host.thresholds.find(threshold => host.value >= threshold.min) || {
					label: '',
					color: 'var(--color-primary)',
				},
		)

		expose({
			value: asNumber(() => meter.value),
			thresholds: asJSON<BasicGaugeThreshold[], {}>([]),
		})

		return [
			watch(['value', 'thresholds'], () => {
				host.style.setProperty(
					'--basic-gauge-degree',
					`${(240 * host.value) / max}deg`,
				)
				host.style.setProperty('--basic-gauge-color', qualification.get().color)
			}),
			watch('value', bindProperty(meter, 'value')),
			pass(valueEl, { value: () => host.value }),
			watch(qualification, q => {
				label.textContent = q.label
			}),
		]
	},
)
