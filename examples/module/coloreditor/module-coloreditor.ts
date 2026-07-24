import {
	colorsNamed,
	converter,
	differenceCiede2000,
	formatCss,
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
const oklchConverter = converter('oklch')

/**
 * An interactive color editor with Oklch input, named color lookup, and a full lightness scale preview.
 * Use it for exploring and selecting colors — provides form inputs for Oklch channels
 * and should be paired with `module-colorinfo` for full color detail display.
 * The `color` attribute must be a valid Oklch color string; out-of-gamut values are clamped.
 * @demo {./docs/examples/module-coloreditor.html} Interactive preview and usage examples */
export default defineComponent<ModuleColoreditorProps>(
	'module-coloreditor',
	({ expose, first, host, on, pass }) => {
		const textbox = first('form-textbox', 'Needed to enter a CSS color.')
		const colorgraph = first('form-colorgraph', 'Needed to pick a color in lightness-chroma graph and hue slider.')
		const colorscale = first('card-colorscale', 'Needed to preview color scale.')
		const colorinfoBase = first('module-colorinfo.base', 'module-colorinfo.base is required')

		expose({
			color: asOklch(),
			name: asString('Blue'),
			nearest: () => nearestNamedColor(host.color)[0] ?? '',
			lightness: () => host.color.l,
			chroma: () => host.color.c,
			hue: () => host.color.h ?? 0,
		})

		on(host, 'change', event => {
			const { target } = event
			if (target instanceof HTMLInputElement && target.name === 'name')
				return { name: target.value }
		})
		pass(textbox, {
			value: {
				get: () => host.name,
				set: (v: string) => {
					host.name = v
				},
			},
			description: () => `Nearest named CSS color: ${host.nearest}`,
		})
		pass(colorgraph, {
			// form-colorgraph exposes `value: string` (CSS color), while
			// module-coloreditor works in Oklch objects — bridge the gap.
			value: {
				get: () => formatCss(host.color),
				set: (v: string) => {
					const parsed = oklchConverter(v)
					if (parsed) host.color = parsed as Oklch
				},
			},
		})
		pass(colorscale, {
			color: () => host.color,
			name: () => host.name,
		})
		pass(colorinfoBase, {
			color: () => host.color,
			name: () => `${host.name} 500`,
		})

		for (let i = 1; i < 5; i++) {
			pass(first(`module-colorinfo.lighten${(5 - i) * 20}`), {
				color: () => getStepColor(host.color, 1 - i / 10),
				name: () => `${host.name} ${i * 100}`,
			})
		}
		for (let i = 1; i < 5; i++) {
			pass(first(`module-colorinfo.darken${i * 20}`), {
				color: () => getStepColor(host.color, 1 - (i + 5) / 10),
				name: () => `${host.name} ${(i + 5) * 100}`,
			})
		}
	},
)
