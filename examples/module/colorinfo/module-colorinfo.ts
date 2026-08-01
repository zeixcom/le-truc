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
	label: string
	/** Color value in Oklch format. Parsed from the `value` attribute at connect time. */
	value: Oklch
	/** CSS color string derived from `value` (read-only, computed). */
	readonly css: string
	/** Hex color string derived from `value` (read-only, computed). */
	readonly hex: string
	/** RGB color string derived from `value` (read-only, computed). */
	readonly rgb: string
	/** HSL color string derived from `value` (read-only, computed). */
	readonly hsl: string
	/** Lightness channel of `value` (read-only, computed). */
	readonly lightness: number
	/** Chroma channel of `value` (read-only, computed). */
	readonly chroma: number
	/** Hue channel of `value` (read-only, computed). */
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
 * The `value` attribute accepts any valid CSS color string and is parsed
 * internally into Oklch via `asOklch`.
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
			label: labelStrong.textContent?.trim() ?? '',
			value: asOklch(),
			css: () => formatCss(host.value),
			hex: () => formatHex(host.value),
			rgb: () => formatRgb(host.value) ?? '',
			hsl: () => formatHsl(host.value) ?? '',
			lightness: () => host.value.l,
			chroma: () => host.value.c,
			hue: () => host.value.h ?? 0,
		})

		const lightnessEls = all('basic-number.lightness')
		const chromaEls = all('basic-number.chroma')
		const hueEls = all('basic-number.hue')
		pass(lightnessEls, { value: () => host.lightness })
		pass(chromaEls, { value: () => host.chroma })
		pass(hueEls, { value: () => host.hue })

		watch('css', bindStyle(host, '--module-colorinfo-color-swatch'))
		watch('hex', bindStyle(host, '--module-colorinfo-color-fallback'))
		watch('label', bindText(labelStrong))
		const hexEl = first('.hex')
		if (hexEl) watch('hex', bindText(hexEl))
		const rgbEl = first('.rgb')
		if (rgbEl) watch('rgb', bindText(rgbEl))
		const hslEl = first('.hsl')
		if (hslEl) watch('hsl', bindText(hslEl))
	},
)
