import { bindText, defineComponent } from '../../../index'
import 'culori/css'
import { formatCss, formatHex, type Oklch } from 'culori/fn'
import { asOklch } from '../../_common/asOklch.ts'
import { getStepColor } from '../../_common/getStepColor.ts'

export type CardColorscaleProps = {
	/** Display name of the color (e.g. "Blue"). */
	label: string
	/** Base color in Oklch format. Parsed from the `value` attribute at connect time. */
	value: Oklch
}

declare global {
	interface HTMLElementTagNameMap {
		'card-colorscale': HTMLElement & CardColorscaleProps
	}
}

const CONTRAST_THRESHOLD = 0.71 // lightness

/**
 * A color scale card that displays a named color with a full set of lightness steps.
 * Use it for previewing a color palette — provides lightness tints and shades
 * for when you need to evaluate contrast and accessibility of a base color.
 * The `value` attribute accepts any valid CSS color string (hex, named, `rgb()`,
 * `hsl()`, `oklch()`, etc.) and is parsed internally into Oklch via `asOklch`.
 *
 * @cssprop --card-colorscale-max-size - Maximum width/height of the card. Defaults to `18rem`.
 * @cssprop --card-colorscale-padding - Inner padding of the card. Defaults to `0.5em`.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#card-colorscale} Interactive preview and usage examples
 **/
export default defineComponent<CardColorscaleProps>(
	'card-colorscale',
	({ expose, first, host, watch }) => {
		const labelStrong = first(
			'.label strong',
			'Add a <strong> element inside .label.',
		)

		expose({
			label: labelStrong.textContent?.trim() ?? '',
			value: asOklch(),
		})

		watch('label', bindText(labelStrong))

		const labelSmall = first(
			'.label small',
			'Add a <small> element inside .label.',
		)
		watch('value', color => {
			labelSmall.textContent = formatHex(color)
			const props = new Map<string, string>()
			const isLight = color.l > CONTRAST_THRESHOLD
			const softStep = isLight ? 0.1 : 0.9
			props.set('base', formatCss(color))
			props.set('text', isLight ? 'black' : 'white')
			props.set('text-soft', formatCss(getStepColor(color, softStep)))
			for (let i = 4; i > 0; i--)
				props.set(
					`lighten${i * 20}`,
					formatCss(getStepColor(color, (5 + i) / 10)),
				)
			for (let i = 1; i < 5; i++)
				props.set(
					`darken${i * 20}`,
					formatCss(getStepColor(color, (5 - i) / 10)),
				)
			for (const [key, value] of props)
				host.style.setProperty(`--card-colorscale-color-${key}`, value)
		})
	},
)
