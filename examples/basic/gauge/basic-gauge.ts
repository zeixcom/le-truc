import {
	asJSON,
	asNumber,
	type Component,
	createMemo,
	defineComponent,
	pass,
	setProperty,
	setStyle,
	setText,
} from '../../..'

import type { BasicNumberProps } from '../number/basic-number'

export type BasicGaugeProps = {
	value: number
	thresholds: BasicGaugeThreshold[]
}

export type BasicGaugeThreshold = {
	min: number
	label: string
	color: string
}

type BasicGaugeUI = {
	meter: HTMLMeterElement
	value: Component<BasicNumberProps>
	label: HTMLElement
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-gauge': Component<BasicGaugeProps>
	}
}

export default defineComponent<BasicGaugeProps, BasicGaugeUI>(
	'basic-gauge',
	{
		value: asNumber(ui => ui.meter.value),
		thresholds: asJSON<BasicGaugeThreshold[], BasicGaugeUI>([]),
	},
	({ first }) => ({
		meter: first('meter', 'Add a <meter> element to display the level'),
		value: first(
			'basic-number',
			'Add a <basic-number> element to display the value',
		),
		label: first('.label', 'Add an element to display the qualification label'),
	}),
	({ host, meter }) => {
		const max = meter.max
		const qualification = createMemo(
			() =>
				host.thresholds.find(threshold => host.value >= threshold.min) || {
					label: '',
					color: 'var(--color-primary)',
				},
		)
		return {
			host: [
				setStyle(
					'--basic-gauge-degree',
					() => `${(240 * host.value) / max}deg`,
				),
				setStyle('--basic-gauge-color', () => qualification.get().color),
			],
			meter: setProperty('value'),
			value: pass({ value: () => host.value }),
			label: setText(() => qualification.get().label),
		}
	},
)
