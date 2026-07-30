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
 * Use it for inspecting a color's various representations — useful when you need
 * to evaluate contrast for accessibility or copy a specific format.
 * The `color` attribute must be a valid Oklch color string.
 *
 * @cssprop --module-colorinfo-swatch-size - The size of the color swatch.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-colorinfo} Interactive preview and usage examples
 **/
export default defineComponent<ModuleColorinfoProps>(
	'module-colorinfo',
	({ all, expose, first, host, pass, watch }) => {
		const labelStrong = first(
			'.label strong',
			'Add a <strong> element inside .label.',
		)

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

		const lightnessEls = all('basic-number.lightness')
		const chromaEls = all('basic-number.chroma')
		const hueEls = all('basic-number.hue')
		pass(lightnessEls, { value: () => host.lightness })
		pass(chromaEls, { value: () => host.chroma })
		pass(hueEls, { value: () => host.hue })

		watch('css', bindStyle(host, '--module-colorinfo-color-swatch'))
		watch('hex', bindStyle(host, '--module-colorinfo-color-fallback'))
		watch('name', bindText(labelStrong))
		const hexEl = first('.hex')
		if (hexEl) watch('hex', bindText(hexEl))
		const rgbEl = first('.rgb')
		if (rgbEl) watch('rgb', bindText(rgbEl))
		const hslEl = first('.hsl')
		if (hslEl) watch('hsl', bindText(hslEl))
	},
)
