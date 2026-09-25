/**
 * Wave-4 migration (LT-098) of the hand-written module-colorinfo.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template renders what module-colorinfo.html authors by hand. The server
 * half parses the `value` arg once (`color`) and renders the swatch style, the
 * hex/RGB/HSL text and the six composed `basic-number` values from it, so the
 * served markup is complete before JavaScript. The client half is the twin's:
 * `asOklch()` re-parses the root attribute, and the watches rebind every site.
 *
 * The twin's `pass()` per `all('basic-number.<channel>')` is spelled
 * `truc:pass` on each `BasicNumber` site: the two same-class sites of a
 * channel carry identical objects, so they share one `all()` query (LT-319).
 * culori modes register through the `asOklch` import, the corpus's one
 * culori setup point (LT-091 finding 3).
 */

import { bindStyle, bindText, type FactoryContext } from '@zeix/le-truc'
import 'culori/css'
import {
	formatCss,
	formatHex,
	formatHsl,
	formatRgb,
	type Oklch,
} from 'culori/fn'
import { asOklch } from '../../_common/asOklch.ts'
import { BasicNumber } from '../../basic/number/basic-number.tsrx'

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
export function ModuleColorinfo(
	{
		label,
		value,
		open = true,
	}: {
		label: string
		value: string
		/** Whether the details start expanded (module-coloreditor opens only its base step). */
		open?: boolean
		/**
		 * Compiler-consumed compose surface (truc:pass), never a render arg:
		 * module-coloreditor passes each step's color and label.
		 */
		'truc:pass'?: { value?: () => Oklch; label?: () => string }
	},
	{ expose, first, host, watch }: FactoryContext<ModuleColorinfoProps>,
) {
	const color = asOklch()(value)
	const labelStrong = first('strong', 'Add a <strong> element inside .label.')
	const hexEl = first('.hex')
	const rgbEl = first('.rgb')
	const hslEl = first('.hsl')

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
	});

	// `label` needs no watch here: the arg renders the <strong> that seeds the
	// prop, and the compiler binds that one site (the arg-and-prop coincidence).
	watch('css', bindStyle(host, '--module-colorinfo-color-swatch'));
	watch('hex', bindStyle(host, '--module-colorinfo-color-fallback'));
	// The text sites are optional (a page may omit them), and an `if` is
	// outside the setup subset (LTC005), so the guard sits in the handler.
	watch('hex', hexEl ? bindText(hexEl) : () => { });
	watch('rgb', rgbEl ? bindText(rgbEl) : () => { });
	watch('hsl', hslEl ? bindText(hslEl) : () => { });

	return (
		<>
			<module-colorinfo
				value={value}
				style={`--module-colorinfo-color-swatch: ${formatCss(color)}; --module-colorinfo-color-fallback: ${formatHex(color)};`}
			>
				<details open={open}>
					<summary>
						<div class="summary">
							<span class="swatch" />
							<span class="label">
								<strong>{label}</strong>
								<small class="hex">{formatHex(color)}</small>
							</span>
						</div>
					</summary>
					<div class="details">
						<dl>
							<dt>Lightness:</dt>
							<dd>
								<BasicNumber
									class="lightness"
									value={color.l}
									truc:pass={{ value: () => host.lightness }}
									options='{"style":"percent","maximumFractionDigits":2}'
								/>
							</dd>
							<dt>Chroma:</dt>
							<dd>
								<BasicNumber
									class="chroma"
									value={color.c}
									truc:pass={{ value: () => host.chroma }}
									options='{"maximumFractionDigits":4}'
								/>
							</dd>
							<dt>Hue:</dt>
							<dd>
								<BasicNumber
									class="hue"
									value={color.h ?? 0}
									truc:pass={{ value: () => host.hue }}
									options='{"maximumFractionDigits":2}'
								/>
							</dd>
						</dl>
						<dl>
							<dt>OKLCH:</dt>
							<dd lang="en">
								oklch(
								<BasicNumber
									class="lightness"
									value={color.l}
									truc:pass={{ value: () => host.lightness }}
									options='{"maximumFractionDigits":4}'
								/>{' '}
								<BasicNumber
									class="chroma"
									value={color.c}
									truc:pass={{ value: () => host.chroma }}
									options='{"maximumFractionDigits":4}'
								/>{' '}
								<BasicNumber
									class="hue"
									value={color.h ?? 0}
									truc:pass={{ value: () => host.hue }}
									options='{"maximumFractionDigits":2}'
								/>
								)
							</dd>
							<dt>RGB:</dt>
							<dd class="rgb">{formatRgb(color) ?? ''}</dd>
							<dt>HSL:</dt>
							<dd class="hsl">{formatHsl(color) ?? ''}</dd>
						</dl>
					</div>
				</details>
			</module-colorinfo>

			<style>{css`
			module-colorinfo {
				--module-colorinfo-swatch-size: var(--input-height);
				--module-colorinfo-color-fallback: transparent;

				display: inline-flex;
				gap: var(--space-l);

				& summary {
					cursor: pointer;
					margin: 0 0 var(--space-s);

					&::marker {
						color: var(--color-text-soft);
					}
				}

				& details[open] summary {
					margin-bottom: var(--space-xs);
				}

				.summary {
					display: inline-flex;
					align-items: center;
					gap: var(--space-s);
					margin-left: var(--space-xs);
					vertical-align: middle;
				}

				.swatch {
					position: relative;
					display: inline-block;
					background: var(--module-colorinfo-color-swatch);
					width: var(--module-colorinfo-swatch-size);
					height: var(--module-colorinfo-swatch-size);
					border-radius: var(--space-xxs);
					overflow: hidden;

					&::before {
						position: absolute;
						content: "";
						display: block;
						width: 0;
						height: 0;
						border-left: var(--module-colorinfo-swatch-size) solid transparent;
						border-bottom: var(--module-colorinfo-swatch-size) solid
							var(--module-colorinfo-color-fallback);
					}
				}

				.label {
					display: inline-block;
					line-height: 1;
				}

				& strong,
				& small {
					display: block;
				}

				& strong {
					font-size: var(--font-size-m);
				}

				& small {
					color: var(--color-text-soft);
					font-size: var(--font-size-xs);
				}

				.details {
					display: flex;
					flex-wrap: wrap;
					gap: 0 var(--space-m);
					margin-left: var(--space-l);
				}

				& dl {
					margin: 0 0 var(--space-s);
					display: inline-grid;
					grid-template-rows: auto auto;
					gap: var(--space-xxs) var(--space-xs);

					&:last-of-type dt {
						display: none;
					}
				}

				& dt {
					grid-column: 1;
					color: var(--color-text-soft);
					display: inline-block;
					text-align: right;
					font-size: var(--font-size-s);
					font-weight: 400;
					line-height: var(--line-height-s);
				}

				& dd {
					grid-column: 2;
					display: inline-block;
					margin: 0;
					font-size: var(--font-size-s);
					line-height: var(--line-height-s);
				}
			}
			`}</style>
		</>
	)
}
