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
	name: string
	color: Oklch
	readonly css: string
	readonly hex: string
	readonly rgb: string
	readonly hsl: string
	readonly lightness: number
	readonly chroma: number
	readonly hue: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-colorinfo': HTMLElement & ModuleColorinfoProps
	}
}

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
