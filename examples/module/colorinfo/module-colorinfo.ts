import { bindStyle, bindText, defineComponent } from '../../..'
import 'culori/css'
import {
	formatCss,
	formatHex,
	formatHsl,
	formatRgb,
	type Oklch,
} from 'culori/fn'
import { asOklch } from '../../_common/asOklch'

export type ModuleColorinfoProps = {
	/** Display name of the color swatch (e.g. "Blue 500"). */
	name: string
	/** Color value in Oklch format. Read from the `color` attribute at connect time. */
	color: Oklch
	/** CSS color string derived from `color` (read-only, computed). */
	readonly css: string
	/** Hex color string derived from `color` (read-only, computed). */
	readonly hex: string
	/** RGB color string derived from `color` (read-only, computed). */
	readonly rgb: string
	/** HSL color string derived from `color` (read-only, computed). */
	readonly hsl: string
	/** Lightness channel of `color` (read-only, computed). */
	readonly lightness: number
	/** Chroma channel of `color` (read-only, computed). */
	readonly chroma: number
	/** Hue channel of `color` (read-only, computed). */
	readonly hue: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-colorinfo': HTMLElement & ModuleColorinfoProps
	}
}

/**
 * Displays detailed color information (CSS, HEX, RGB, HSL, Oklch channels) for a given color.
 * @cssprop --color-swatch - The CSS color string, set reactively from the `css` property.
 * @cssprop --color-fallback - The HEX color string, set reactively from the `hex` property.
 */
export default defineComponent<ModuleColorinfoProps>(
	'module-colorinfo',
	({ all, expose, first, host, pass, watch }) => {
		const labelStrong = first(
			'.label strong',
			'Add a <strong> element inside .label.',
		)
		const hexEl = first('.hex')
		const rgbEl = first('.rgb')
		const hslEl = first('.hsl')
		const lightnessEls = all('basic-number.lightness')
		const chromaEls = all('basic-number.chroma')
		const hueEls = all('basic-number.hue')

		expose({
			name: labelStrong.textContent?.trim() ?? '',
			color: asOklch(),
			css: () => formatCss(host.color),
			hex: () => formatHex(host.color),
			rgb: () => formatRgb(host.color) ?? '',
			hsl: () => formatHsl(host.color) ?? '',
			lightness: () => host.color.l,
			chroma: () => host.color.c,
			hue: () => host.color.h ?? 0,
		})

		return [
			pass(lightnessEls, { value: 'lightness' }),
			pass(chromaEls, { value: 'chroma' }),
			pass(hueEls, { value: 'hue' }),

			watch('css', bindStyle(host, '--color-swatch')),
			watch('hex', bindStyle(host, '--color-fallback')),
			watch('name', bindText(labelStrong)),
			hexEl && watch('hex', bindText(hexEl)),
			rgbEl && watch('rgb', bindText(rgbEl)),
			hslEl && watch('hsl', bindText(hslEl)),
		]
	},
)
