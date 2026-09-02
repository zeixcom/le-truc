/**
 * Unified-format migration: basic-pluralize (LT-115 cutover, closing the
 * LT-092 stop). Reshaped to the hand-written twin's contract, the same
 * LT-114 basic-number route: no setup signals remain — the six category
 * spans' `hidden` thunks compute the CLDR category inline (the LT-115
 * compiler fixes make the as-authored `deriveCell` shape live too, but a
 * signal body may not read `host` — TSRX013 — and the twin's locale
 * resolution NEEDS the host: `getLocale` walks `closest('[lang]')`, so
 * hydration pages may carry the locale on an ANCESTOR, which no
 * root-attribute read can see; the authored thunk is the one
 * compiler-expressible home, exactly like basic-number's formatter).
 *
 * Contract notes (restored to the hand-written twin, per the
 * TSRX-HOST-PROFILE data account):
 * - Locale inherits from the nearest `[lang]` (the element itself or any
 *   ancestor) via the shared `getLocale` helper — the twin's own rule; the
 *   `lang` server arg still materializes the root attribute for SSR markup,
 *   where `getLocale` finds it on the element.
 * - `ordinal` is read from the element's own attribute at each evaluation
 *   (presence-only, the twin's `hasAttribute` shape).
 * - The pluralizer is re-derived per evaluation — a display component's
 *   trade, the twin's behavior everywhere the specs observe it (LT-114's
 *   formatter precedent).
 * - The six CLDR category spans are ALWAYS present (the template's own
 *   structure); a locale that doesn't use a category simply never matches
 *   and stays hidden. The twin tolerated a PAGE omitting individual spans
 *   (`if (el)` guards) — the compiled template requires the six-span
 *   structure in hydrated markup; the demo was regenerated to carry it
 *   (escalated in NOTES.md, LT-115).
 * - The `hidden` thunks have no server-renderable initial value (`Intl` is
 *   an impure ambient — CHECKLIST §4 refuses to fold the BUILD MACHINE's
 *   locale into the page), so SSR omits `hidden` and the client's first
 *   pass corrects — the documented flash trade, pinned by the six TSRX034
 *   warnings this compile carries (same class as form-listbox's).
 */

import { asClampedInteger } from '@zeix/le-truc'
import { getLocale } from '../../_common/getLocale'

export type BasicPluralizeProps = {
	/** The count to pluralize. Clamped to a non-negative integer. */
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-pluralize': HTMLElement & BasicPluralizeProps
	}
}

/**
 * Shows locale-aware plural forms of content based on a count.
 * Use it for internationalised prose where the correct plural form must be shown —
 * accessibility tools and screen readers benefit from grammatically correct output.
 * Reveal children by class: `.none` (0), `.some` (>0), and `.zero/.one/.two/.few/.many/.other` per CLDR plural rules.
 *
 * @attribute {string} [lang] - BCP 47 locale tag (e.g. `ar`). Falls back to the nearest ancestor's `lang` attribute, or `en` if none is set. Read once at connect time.
 * @attribute {boolean} [ordinal=false] - Use ordinal plural rules (1st, 2nd, 3rd, ...) instead of cardinal. Presence-only; read once at connect time.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-pluralize} Interactive preview and usage examples
 **/
export function BasicPluralize(
	{ count, lang = 'en', ordinal = false }: { count: number; lang?: string; ordinal?: boolean },
)
	@{
		const pluralCategory = (el: HTMLElement & BasicPluralizeProps) =>
			new Intl.PluralRules(
				getLocale(el),
				el.hasAttribute('ordinal') ? { type: 'ordinal' } : undefined,
			).select(el.count)

		expose({ count: asClampedInteger() })

		<>
			<basic-pluralize {count} {lang} {ordinal}>
				<p class="none" hidden={() => host.count !== 0}>Well done, all done!</p>
				<p class="some" hidden={() => host.count === 0}>
					<span class="count">{host.count}</span>
					task
					<span class="zero" hidden={() => pluralCategory(host) !== 'zero'}></span>
					<span class="one" hidden={() => pluralCategory(host) !== 'one'}></span>
					<span class="two" hidden={() => pluralCategory(host) !== 'two'}>s</span>
					<span class="few" hidden={() => pluralCategory(host) !== 'few'}>s</span>
					<span class="many" hidden={() => pluralCategory(host) !== 'many'}>s</span>
					<span class="other" hidden={() => pluralCategory(host) !== 'other'}>s</span>
					remaining
				</p>
			</basic-pluralize>

			<style>
			basic-pluralize {
				display: inline;

				& .count::after {
					content: " ";
				}
			}
			</style>
		</>
	}
