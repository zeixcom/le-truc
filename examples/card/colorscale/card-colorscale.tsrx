/**
 * Isomorphic-format migration: card-colorscale — a named color swatch with a
 * full lightness-step scale, driven by a `value` prop parsed into Oklch via
 * the existing `asOklch()` custom Parser (LT-033, re-migrated for LT-034).
 *
 * Deviation from the hand-written `card-colorscale.ts`: the original builds
 * its 11 CSS custom properties (`base`, `text`, `text-soft`, four
 * `lighten*`, four `darken*`) in a `Map` via two `for` loops and applies
 * them with `host.style.setProperty()` calls inside one `watch()` callback.
 * TSRX's `style={() => ({ … })}` lowering (LT-028/LT-029) requires the
 * object literal's keys to be statically enumerable at compile time — a
 * loop-computed key set can't be read by the compiler. The keys here are
 * fixed at 11 regardless (the loop bounds are constants), so the loop is
 * manually unrolled into one explicit 11-key object literal on the root's
 * `style` attribute; a `scale` `deriveCell` does the actual Oklch math in
 * one place (LT-034 landed import-placement inference, so `culori/fn` and
 * the local color-math helpers below are usable directly in setup code —
 * they're inferred client-only, since both are only used inside the root's
 * `style={}` thunk, which the server never renders: its dependency is
 * `host.value`, and `host` is never server-known).
 *
 * The per-property math is factored into plain setup helper functions
 * (`step`, `isLight`) rather than a `deriveCell` — a `deriveCell` used only
 * inside a `style-map`/`class-map` thunk isn't registered as a harvest site
 * (TSRX004 "signal never rendered"; tracked separately as LT-036), so it
 * would need an unused dummy render site. Plain functions sidestep that gap
 * entirely — recompute per key, no caching, but no dummy DOM either.
 *
 * Both helpers are pure (color passed as a parameter, not read from `host`
 * internally) — `component.setup` is emitted verbatim into the SERVER render
 * function too (ADR 0024 sub-design 12), which has no `host`; only the
 * `style={}` thunk itself may read `host.value` directly, the one position
 * with the `host`→arg mirror the server understands (same rule `basic-gauge
 * .tsrx` follows for its `qualification` derivation).
 */
import { expose, host } from '@zeix/le-truc'
import 'culori/css'
import { formatCss, formatHex, type Oklch } from 'culori/fn'
import { asOklch } from '../../_common/asOklch.ts'
import { getStepColor } from '../../_common/getStepColor.ts'

export type CardColorscaleProps = {
	/** Display name of the color (e.g. "Blue"). */
	label: string
	/** Base color in Oklch format. Parsed from the `value` attribute at connect time. */
	value: Oklch
}

declare global {
	interface HTMLElementTagNameMap {
		'card-colorscale': HTMLElement & CardColorscaleProps
	}
}

/**
 * A color scale card that displays a named color with a full set of lightness steps.
 * Use it for previewing a color palette — provides lightness tints and shades
 * for when you need to evaluate contrast and accessibility of a base color.
 * The `value` attribute accepts any valid CSS color string (hex, named, `rgb()`,
 * `hsl()`, `oklch()`, etc.) and is parsed internally into Oklch via `asOklch`.
 *
 * @cssprop --card-colorscale-max-size - Maximum width/height of the card. Defaults to `18rem`.
 * @cssprop --card-colorscale-padding - Inner padding of the card. Defaults to `0.5em`.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#card-colorscale} Interactive preview and usage examples
 **/
export function CardColorscale({ label }: { label: string })
	@{
		const CONTRAST_THRESHOLD = 0.71 // lightness
		const isLight = (color: Oklch) => color.l > CONTRAST_THRESHOLD
		const step = (color: Oklch, frac: number) => formatCss(getStepColor(color, frac))

		expose({
			label: asString(''),
			value: asOklch(),
		})

		<>
			<card-colorscale
				{label}
				style={() => ({
					'--card-colorscale-color-base': formatCss(host.value),
					'--card-colorscale-color-text': isLight(host.value) ? 'black' : 'white',
					'--card-colorscale-color-text-soft': step(host.value, isLight(host.value) ? 0.1 : 0.9),
					'--card-colorscale-color-lighten80': step(host.value, 0.9),
					'--card-colorscale-color-lighten60': step(host.value, 0.8),
					'--card-colorscale-color-lighten40': step(host.value, 0.7),
					'--card-colorscale-color-lighten20': step(host.value, 0.6),
					'--card-colorscale-color-darken20': step(host.value, 0.4),
					'--card-colorscale-color-darken40': step(host.value, 0.3),
					'--card-colorscale-color-darken60': step(host.value, 0.2),
					'--card-colorscale-color-darken80': step(host.value, 0.1),
				})}
			>
				<ol role="presentation">
					<li class="lighten80"></li>
					<li class="lighten60"></li>
					<li class="lighten40"></li>
					<li class="lighten20"></li>
					<li class="base">
						<span class="label">
							<strong>{host.label}</strong>
							<small>{() => formatHex(host.value)}</small>
						</span>
					</li>
					<li class="darken20"></li>
					<li class="darken40"></li>
					<li class="darken60"></li>
					<li class="darken80"></li>
				</ol>
			</card-colorscale>

			<style>
			card-colorscale {
				--card-colorscale-max-size: 18rem;
				--card-colorscale-padding: 0.5em;
				--card-colorscale-color-text: white;

				display: inline-flex;
				margin: 0 auto;

				& ol {
					display: grid;
					list-style: none;
					margin: 0 auto;
					border-radius: 6% / 4%;
					padding: 0;
					grid-template-areas:
						"lighten80 lighten60 lighten40 lighten20"
						"base base base base"
						"darken20 darken40 darken60 darken80";
					grid-template-columns: repeat(4, 1fr);
					grid-template-rows: 1fr 4fr 1fr;
					aspect-ratio: 2 / 3;
					min-height: min(100%, 150cqw, 100cqh, var(--card-colorscale-max-size));
					max-width: calc(2 * var(--card-colorscale-max-size) / 3);
					overflow: hidden;
					object-fit: contain;
					align-self: center;
					container-type: inline-size;
					gap: 0;
				}

				&.tiny {
					& ol {
						height: 3rem;
					}

					.label {
						display: none;
					}
				}

				&.small {
					& ol {
						height: 7.5rem;
					}

					.label small {
						display: none;
					}
				}

				&.medium ol {
					height: 12rem;
				}

				&.large ol {
					height: 18rem;
				}

				& li {
					margin: 0;
				}

				.lighten80 {
					grid-area: lighten80;
					background: var(--card-colorscale-color-lighten80);
				}
				.lighten60 {
					grid-area: lighten60;
					background: var(--card-colorscale-color-lighten60);
				}
				.lighten40 {
					grid-area: lighten40;
					background: var(--card-colorscale-color-lighten40);
				}
				.lighten20 {
					grid-area: lighten20;
					background: var(--card-colorscale-color-lighten20);
				}
				.base {
					grid-area: base;
					background: var(--card-colorscale-color-base);
				}
				.darken20 {
					grid-area: darken20;
					background: var(--card-colorscale-color-darken20);
				}
				.darken40 {
					grid-area: darken40;
					background: var(--card-colorscale-color-darken40);
				}
				.darken60 {
					grid-area: darken60;
					background: var(--card-colorscale-color-darken60);
				}
				.darken80 {
					grid-area: darken80;
					background: var(--card-colorscale-color-darken80);
				}

				.base {
					display: flex;
					flex-direction: column;
					justify-content: flex-end;
					align-items: flex-start;
					padding: var(--card-colorscale-padding);
					line-height: 1;
				}

				& strong {
					display: block;
					color: var(--card-colorscale-color-text);
					font-size: 15cqi;
					font-weight: 700;
				}

				& small {
					display: block;
					color: var(--card-colorscale-color-text-soft);
					font-size: 10cqi;
					font-weight: 400;
				}
			}

			@container (width < 5rem) or (height < 7.5rem) {
				card-colorscale .label {
					display: none;
				}
			}

			@container (width < 8rem) or (height < 12rem) {
				card-colorscale .label small {
					display: none;
				}
			}
			</style>
		</>
	}
