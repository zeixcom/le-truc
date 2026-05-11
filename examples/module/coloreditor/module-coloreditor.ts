import {
	colorsNamed,
	differenceCiede2000,
	nearest,
	type Oklch,
} from 'culori/fn'
import { asString, defineComponent } from '../../..'
import { asOklch } from '../../_common/asOklch'
import { getStepColor } from '../../_common/getStepColor'

export type ModuleColoreditorProps = {
	/** Current color in Oklch format. Read from the `color` attribute at connect time. */
	color: Oklch
	/** Display name for the color. Read from the `name` attribute at connect time (default: "Blue"). */
	name: string
	/** Nearest named CSS color to the current Oklch value (read-only, computed). */
	readonly nearest: string
	/** Lightness channel of the current color (read-only, computed). */
	readonly lightness: number
	/** Chroma channel of the current color (read-only, computed). */
	readonly chroma: number
	/** Hue channel of the current color (read-only, computed). */
	readonly hue: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-coloreditor': HTMLElement & ModuleColoreditorProps
	}
}

const nearestNamedColor = nearest(
	Object.keys(colorsNamed),
	differenceCiede2000(),
)

/**
 * An interactive color editor with Oklch input, named color lookup, and a full lightness scale preview.
 */
export default defineComponent<ModuleColoreditorProps>(
	'module-coloreditor',
	({ expose, first, host, on, pass }) => {
		const textbox = first('form-textbox')
		const colorgraph = first('form-colorgraph')
		const colorscale = first('card-colorscale')
		const colorinfoBase = first('module-colorinfo.base')

		expose({
			color: asOklch(),
			name: asString('Blue'),
			nearest: () => nearestNamedColor(host.color)[0] ?? '',
			lightness: () => host.color.l,
			chroma: () => host.color.c,
			hue: () => host.color.h ?? 0,
		})

		const effects = [
			on(host, 'change', event => {
				const { target } = event
				if (target instanceof HTMLInputElement && target.name === 'name')
					return { name: target.value }
			}),
			textbox &&
				pass(textbox, {
					value: 'name',
					description: () => `Nearest named CSS color: ${host.nearest}`,
				}),
			colorgraph && pass(colorgraph, { color: 'color' }),
			colorscale && pass(colorscale, { color: 'color', name: 'name' }),
			colorinfoBase &&
				pass(colorinfoBase, {
					color: 'color',
					name: () => `${host.name} 500`,
				}),
		]

		for (let i = 1; i < 5; i++) {
			const infoLighten = first(`module-colorinfo.lighten${(5 - i) * 20}`)
			effects.push(
				pass(infoLighten, {
					color: () => getStepColor(host.color, 1 - i / 10),
					name: () => `${host.name} ${i * 100}`,
				}),
			)
		}
		for (let i = 1; i < 5; i++) {
			const infoDarken = first(`module-colorinfo.darken${i * 20}`)
			effects.push(
				pass(infoDarken, {
					color: () => getStepColor(host.color, 1 - (i + 5) / 10),
					name: () => `${host.name} ${(i + 5) * 100}`,
				}),
			)
		}

		return effects
	},
)
