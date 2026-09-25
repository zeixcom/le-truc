/**
 * Wave-4 migration (LT-105) of the hand-written module-coloreditor.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template composes what module-coloreditor.html authors by hand: the
 * colorscale, the colorgraph, the name textbox, and nine colorinfo steps.
 * Each step is its own compose site with a distinct class and its own
 * `truc:pass`, so the twin's two `for` loops of `pass()` calls are unrolled
 * (steps `lighten80` … `darken80`, labels `100` … `900`).
 *
 * Server renders beyond the twin: the textbox's value and description, and
 * every colorinfo step's label and color, all from args, so pre-JS markup is
 * complete. The colorscale's `value` is not a server arg of that child, so
 * its swatches still fill at connect.
 *
 * Deviations from the twin, all setup-subset driven:
 * - `nearestNamedColor` and `oklchConverter` move into setup (module-scope
 *   names are not client-known, LTC005);
 * - the colorgraph, colorscale and colorinfo `pass()` calls are spelled
 *   `truc:pass` on their compose sites. The textbox keeps its mediated
 *   `label` pass as `truc:pass` too, and its description stays a pushed
 *   `watch` + `bindProperty` (LT-113's write-ownership rule).
 */

import { asString, bindProperty, type FactoryContext } from '@zeix/le-truc'
import 'culori/css'
import {
	colorsNamed,
	converter,
	differenceCiede2000,
	formatCss,
	nearest,
	type Oklch,
} from 'culori/fn'
import { asOklch } from '../../_common/asOklch.ts'
import { getStepColor } from '../../_common/getStepColor.ts'
import { CardColorscale } from '../../card/colorscale/card-colorscale.tsrx'
import { FormColorgraph } from '../../form/colorgraph/form-colorgraph.tsrx'
import { FormTextbox } from '../../form/textbox/form-textbox.tsrx'
import { ModuleColorinfo } from '../colorinfo/module-colorinfo.tsx'

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

/**
 * An interactive color editor with Oklch input, named color lookup, and a full lightness scale preview.
 * Use it for exploring and selecting colors — provides form inputs for Oklch channels
 * and should be paired with `module-colorinfo` for full color detail display.
 * The `value` attribute accepts any valid CSS color string; out-of-gamut values are clamped.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-coloreditor} Interactive preview and usage examples
 **/
export function ModuleColoreditor(
	{
		value = 'oklch(.48 .23 263)',
		label = 'Blue',
	}: {
		/** Any CSS color string; parsed into Oklch. */
		value?: string
		label?: string
	},
	{ expose, first, host, on, watch }: FactoryContext<ModuleColoreditorProps>,
) {
	const nearestNamedColor = nearest(
		Object.keys(colorsNamed),
		differenceCiede2000(),
	)
	const oklchConverter = converter('oklch')
	const color = asOklch()(value)
	const step = (frac: number) => formatCss(getStepColor(color, frac))

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

	return (
		<>
			<module-coloreditor value={value} label={label}>
				<CardColorscale
					class="scale tiny"
					label={label}
					truc:pass={{
						value: () => host.value,
						label: () => host.label,
					}}
				/>
				<FormColorgraph
					name="color"
					value={formatCss(color)}
					truc:pass={{
						// form-colorgraph exposes `value: string` (CSS color), while
						// module-coloreditor works in Oklch objects — bridge the gap.
						value: {
							get: () => formatCss(host.value),
							set: (v: unknown) => {
								const parsed = oklchConverter(v as string)
								if (parsed) host.value = parsed as Oklch
							},
						},
					}}
				/>
				<FormTextbox
					class="name"
					name="name"
					label="Color name"
					value={label}
					required
					description={`Nearest named CSS color: ${nearestNamedColor(color)[0] ?? ''}`}
					truc:pass={{
						value: {
							get: () => host.label,
							set: (v: unknown) => {
								host.label = v as string
							},
						},
					}}
				/>
				<div class="info">
					<ModuleColorinfo
						class="lighten80"
						label={`${label} 100`}
						value={step(0.9)}
						open={false}
						truc:pass={{
							value: () => getStepColor(host.value, 0.9),
							label: () => `${host.label} 100`,
						}}
					/>
					<ModuleColorinfo
						class="lighten60"
						label={`${label} 200`}
						value={step(0.8)}
						open={false}
						truc:pass={{
							value: () => getStepColor(host.value, 0.8),
							label: () => `${host.label} 200`,
						}}
					/>
					<ModuleColorinfo
						class="lighten40"
						label={`${label} 300`}
						value={step(0.7)}
						open={false}
						truc:pass={{
							value: () => getStepColor(host.value, 0.7),
							label: () => `${host.label} 300`,
						}}
					/>
					<ModuleColorinfo
						class="lighten20"
						label={`${label} 400`}
						value={step(0.6)}
						open={false}
						truc:pass={{
							value: () => getStepColor(host.value, 0.6),
							label: () => `${host.label} 400`,
						}}
					/>
					<ModuleColorinfo
						class="base"
						label={`${label} 500`}
						value={formatCss(color)}
						truc:pass={{
							value: () => host.value,
							label: () => `${host.label} 500`,
						}}
					/>
					<ModuleColorinfo
						class="darken20"
						label={`${label} 600`}
						value={step(0.4)}
						open={false}
						truc:pass={{
							value: () => getStepColor(host.value, 0.4),
							label: () => `${host.label} 600`,
						}}
					/>
					<ModuleColorinfo
						class="darken40"
						label={`${label} 700`}
						value={step(0.3)}
						open={false}
						truc:pass={{
							value: () => getStepColor(host.value, 0.3),
							label: () => `${host.label} 700`,
						}}
					/>
					<ModuleColorinfo
						class="darken60"
						label={`${label} 800`}
						value={step(0.2)}
						open={false}
						truc:pass={{
							value: () => getStepColor(host.value, 0.2),
							label: () => `${host.label} 800`,
						}}
					/>
					<ModuleColorinfo
						class="darken80"
						label={`${label} 900`}
						value={step(0.1)}
						open={false}
						truc:pass={{
							value: () => getStepColor(host.value, 0.1),
							label: () => `${host.label} 900`,
						}}
					/>
				</div>
			</module-coloreditor>
			<style>{css`
module-coloreditor {
	display: grid;
	grid-template-areas:
		"scale name"
		"graph graph"
		"lightness lightness"
		"chroma chroma"
		"hue hue"
		"info info";
	grid-template-columns: auto 1fr;
	column-gap: var(--space-m);

	> form-colorgraph {
		grid-area: graph;
	}

	> .hue {
		grid-area: hue;
	}

	> .lightness {
		grid-area: lightness;
	}

	> .chroma {
		grid-area: chroma;
	}

	> .scale {
		grid-area: scale;
	}

	> .name {
		grid-area: name;
		margin: var(--space-s) 0;
	}

	> .info {
		grid-area: info;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}
}

@container (width > 45rem) {
	module-coloreditor {
		grid-template-areas:
			"scale name info"
			"graph graph info"
			"lightness lightness info"
			"chroma chroma info"
			"hue hue info";
		grid-template-columns: auto 3fr 2fr;
	}
}
`}</style>
		</>
	)
}
