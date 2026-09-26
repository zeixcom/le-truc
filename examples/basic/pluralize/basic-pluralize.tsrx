/**
 * Unified-format migration: basic-pluralize (LT-115 cutover; re-cut onto the
 * reserved `i18n` parameter in LT-173, ADR 0030; one ICU pattern since
 * LT-252). The component declares `i18n` and receives the
 * compiler-supplied locale record — callers never pass it — so the locale
 * is a build-time fact and the component is Folded-tier. The noun is ONE
 * message, `tasks`, whose plural arms live inside each locale's pattern:
 * the server folds the initial form into the single `.tasks` span, and
 * because `count` is client-reactive the pattern's parsed AST rides the
 * root `i18n` attribute and the client re-evaluates it on change (ADR 0030
 * s6/s9). The six `truc:case` spans and their `hidden` thunks are gone.
 *
 * Contract notes (LT-173 migration of the LT-115 contract; LT-191 restored
 * the ancestor walk):
 * - The locale INHERITS, and `lang` is a CONFIG attribute only (not a
 *   reactive property — it is a built-in IDL property, so expose() could
 *   never install an accessor over it). The walked effective locale
 *   (`getLocale(host)` — own attribute first, else the nearest ancestor
 *   `[lang]`, else `en`) MATERIALIZES onto the attribute at connect,
 *   exactly what the server render does for SSR'd instances, so both paths
 *   converge on one DOM shape. NOT restored: re-walking on ancestor
 *   changes — the locale is fixed at connect, because the catalog never
 *   ships; a client-created instance with no `i18n` attribute speaks the
 *   source locale.
 * - `ordinal` is a Parser-exposed prop (presence), read once at connect.
 *   It selects the pattern's arm through the `type` select argument —
 *   `selectordinal` for 1st/2nd/3rd rules, `plural` otherwise.
 * - "remaining" / "Well done, all done!" are catalog keys, and so is the
 *   noun: it is not "singular plus s" — Welsh tasg/dasg/tasgiau, Arabic's
 *   six forms. The catalog carries the component's own noun in every
 *   locale; the page's light DOM carries no word forms.
 */

import { asBoolean, asClampedInteger } from '@zeix/le-truc'
import { getLocale } from '../../_common/getLocale'

export const i18n = {
	done: 'Well done, all done!',
	remaining: 'remaining',
	// LT-252: one ICU pattern replaces the six `task.<category>` keys — the
	// plural morphology lives inside the value, so each locale spells exactly
	// its own arms. `type` selects the rule set (the `ordinal` prop):
	// `selectordinal` for 1st/2nd/3rd, `plural` otherwise.
	tasks:
		'{type, select, ordinal {{count, selectordinal, one {task} other {tasks}}} other {{count, plural, one {task} other {tasks}}}}',
} as const

export type BasicPluralizeProps = {
	/** The count to pluralize. Clamped to a non-negative integer. */
	count: number
	/** Config attribute only (not a reactive property — `lang` is a built-in IDL property). BCP 47 locale tag; the element's own attribute wins, else the nearest ancestor's, else `en`. The server renders the effective locale onto it; the client materializes the walked locale at connect. */
	lang?: string
	/** Use ordinal plural rules (1st, 2nd, 3rd, ...) instead of cardinal. Presence-only; read once at connect time. */
	ordinal?: boolean
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
 * Reveal children by class: `.none` (0), `.some` (>0); `.tasks` carries the noun, one ICU plural pattern per locale.
 *
 * @attribute {string} [lang] - Config attribute only (not a reactive property). BCP 47 locale tag; the element's own attribute wins, else the nearest ancestor's, else `en`. The server renders the effective locale onto it; the client materializes the walked locale at connect.
 * @attribute {boolean} [ordinal=false] - Use ordinal plural rules (1st, 2nd, 3rd, ...) instead of cardinal. Presence-only; read once at connect time.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-pluralize} Interactive preview and usage examples
 **/
export function BasicPluralize(
	{ count, lang = 'en', ordinal = false, i18n: { t } }: {
		count: number
		lang?: string
		ordinal?: boolean
		i18n: I18n<typeof i18n>
	},
)
	@{
		// LT-191: the locale INHERITS. `lang` is a CONFIG attribute only, not
		// a reactive property — it is a built-in IDL property, so expose()
		// could never install an accessor over it anyway (`prop in this`),
		// and `host.lang` reads the native accessor: the element's OWN
		// attribute, live. The walked effective locale
		// MATERIALIZES onto the attribute before the first evaluation —
		// exactly what the server render does for SSR'd instances (root attr
		// = effective locale), so both paths converge on one DOM shape: own
		// attribute first, else the nearest ancestor [lang], else 'en'.
		// (The const + call is the sanctioned client-only setup shape — the
		// call alone classifies as the connect-time side effect and never
		// runs in the server harness.)
		const materializeLocale = (): void => {
			if (!host.getAttribute('lang'))
				host.setAttribute('lang', getLocale(host))
		}
		materializeLocale()
		expose({
			count: asClampedInteger(),
			ordinal: asBoolean(),
		})

			<>
				<basic-pluralize {count} {lang} {ordinal}>
					<p class="none" hidden={() => host.count !== 0}>{t.done}</p>
					<p class="some" hidden={() => host.count === 0}>
						<span class="count">{host.count}</span>
						<span class="tasks">{() => t.tasks({ count: host.count, type: host.ordinal ? 'ordinal' : 'cardinal' })}</span>
						{t.remaining}
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
