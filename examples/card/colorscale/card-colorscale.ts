import { bindText, defineComponent } from '../../..'
import 'culori/css'
import { formatCss, formatHex, type Oklch } from 'culori/fn'
import { asOklch } from '../../_common/asOklch.ts'
import { getStepColor } from '../../_common/getStepColor.ts'

export type CardColorscaleProps = {
	/** Display name of the color (e.g. "Blue"). */
	name: string
	/** Base color in Oklch format. Read from the `color` attribute at connect time. */
	color: Oklch
}

declare global {
	interface HTMLElementTagNameMap {
		'card-colorscale': HTMLElement & CardColorscaleProps
	}
}

const CONTRAST_THRESHOLD = 0.71 // lightness

/**
 * A color scale card that displays a named Oklch color with a full set of lightness steps.
 * @cssprop --color-base - The base color in CSS format.
 * @cssprop --color-text - Foreground color (black or white) chosen for contrast.
 * @cssprop --color-text-soft - Muted foreground color.
 * @cssprop --color-lighten20 - 20% lighter step.
 * @cssprop --color-lighten40 - 40% lighter step.
 * @cssprop --color-lighten60 - 60% lighter step.
 * @cssprop --color-lighten80 - 80% lighter step.
 * @cssprop --color-darken20 - 20% darker step.
 * @cssprop --color-darken40 - 40% darker step.
 * @cssprop --color-darken60 - 60% darker step.
 * @cssprop --color-darken80 - 80% darker step.
 */
export default defineComponent<CardColorscaleProps>(
	'card-colorscale',
	({ expose, first, host, watch }) => {
		const labelStrong = first(
			'.label strong',
			'Add a <strong> element inside .label.',
		)
		const labelSmall = first(
			'.label small',
			'Add a <small> element inside .label.',
		)

		expose({
			name: labelStrong.textContent?.trim() ?? '',
			color: asOklch(),
		})

		return [
			watch('name', bindText(labelStrong)),
			watch('color', color => {
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
					host.style.setProperty(`--color-${key}`, value)
			}),
		]
	},
)
