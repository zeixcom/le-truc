import { asString, bindProperty, defineComponent } from '@zeix/le-truc'
import {
	colorsNamed,
	converter,
	differenceCiede2000,
	formatCss,
	nearest,
	type Oklch,
} from 'culori/fn'
import { asOklch } from '../../_common/asOklch'
import { getStepColor } from '../../_common/getStepColor'

export type ModuleColoreditorProps = {
	/** Current color in Oklch format. Parsed from the `value` attribute at connect time. */
	value: Oklch
	/** Display name for the color. Read from the `label` attribute at connect time (default: "Blue"). */
	label: string
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
 * The `value` attribute accepts any valid CSS color string; out-of-gamut values are clamped.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-coloreditor} Interactive preview and usage examples
 **/
export default defineComponent<ModuleColoreditorProps>(
	'module-coloreditor',
	({ expose, first, host, on, pass, watch }) => {
		expose({
			value: asOklch(),
			label: asString('Blue'),
			nearest: () => nearestNamedColor(host.value)[0] ?? '',
			lightness: () => host.value.l,
			chroma: () => host.value.c,
			hue: () => host.value.h ?? 0,
		})

		on(host, 'change', event => {
			const { target } = event
			if (target instanceof HTMLInputElement && target.name === 'name')
				return { label: target.value }
		})

		const textbox = first('form-textbox', 'Needed to enter a CSS color.')
		pass(textbox, {
			value: {
				get: () => host.label,
				set: (v: string) => {
					host.label = v
				},
			},
		})
		// LT-113: compose through the public prop — form-textbox exposes a
		// writable description. Per the LT-091 write-ownership rules a
		// parent-derived/child-owned value is PUSHED with watch() +
		// bindProperty() (a property WRITE flows through the exposed Slot
		// into the cell the remaining-count derivation reads); a getter-only
		// pass would swap the Slot's backing and leave that derivation on
		// the stale internal cell.
		watch(
			() => `Nearest named CSS color: ${host.nearest}`,
			bindProperty(textbox, 'description'),
		)

		const colorgraph = first(
			'form-colorgraph',
			'Needed to pick a color in lightness-chroma graph and hue slider.',
		)
		pass(colorgraph, {
			// form-colorgraph exposes `value: string` (CSS color), while
			// module-coloreditor works in Oklch objects — bridge the gap.
			value: {
				get: () => formatCss(host.value),
				set: (v: string) => {
					const parsed = oklchConverter(v)
					if (parsed) host.value = parsed as Oklch
				},
			},
		})

		const colorscale = first(
			'card-colorscale',
			'Needed to preview the color scale.',
		)
		pass(colorscale, {
			value: () => host.value,
			label: () => host.label,
		})

		const colorinfoBase = first('module-colorinfo.base')
		pass(colorinfoBase, {
			value: () => host.value,
			label: () => `${host.label} 500`,
		})

		for (let i = 1; i < 5; i++) {
			pass(first(`module-colorinfo.lighten${(5 - i) * 20}`), {
				value: () => getStepColor(host.value, 1 - i / 10),
				label: () => `${host.label} ${i * 100}`,
			})
		}
		for (let i = 1; i < 5; i++) {
			pass(first(`module-colorinfo.darken${i * 20}`), {
				value: () => getStepColor(host.value, 1 - (i + 5) / 10),
				label: () => `${host.label} ${(i + 5) * 100}`,
			})
		}
	},
)
