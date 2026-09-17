/**
 * Unified-format migration: basic-pluralize (LT-115 cutover; re-cut onto the
 * reserved `i18n` parameter in LT-173, ADR 0030). The component now declares
 * `i18n` and receives the compiler-supplied locale record — callers never
 * pass it — which makes the locale a build-time fact: the six category
 * spans' `hidden` thunks fold server-side (the locale is server-known, so
 * `Intl.PluralRules` folds per LT-142) and the component is Folded-tier;
 * its six former Simulated-tier routing signals are dissolved. `truc:case`
 * marks each span as one rendered plural alternative, so the server prunes
 * to the locale's actual category set ({one, other} for English instead of
 * all six); the `hidden` toggles stay — `host.count` is reactive, so the
 * category still changes at runtime and the client re-selects among the
 * rendered alternatives.
 *
 * Contract notes (LT-173 migration of the LT-115 contract; LT-191 restored
 * the ancestor walk):
 * - The locale INHERITS, and `lang` is a CONFIG attribute only (not a
 *   reactive property — it is a built-in IDL property, so expose() could
 *   never install an accessor over it; the thunks' `host.lang` reads the
 *   native accessor, i.e. the element's OWN attribute, live). The walked
 *   effective locale (`getLocale(host)` — own attribute first, else the
 *   nearest ancestor `[lang]`, else `en`) MATERIALIZES onto the attribute
 *   at connect, exactly what the server render does for SSR'd instances,
 *   so both paths converge on one DOM shape and the walk never disagrees
 *   with the build. NOT restored: re-walking on ancestor changes — the
 *   materialized locale is fixed at connect, because the catalog never
 *   ships and the client can only select among alternatives the server
 *   rendered (ADR 0030 s6).
 * - `ordinal` is a Parser-exposed prop (presence) — the twin re-read
 *   `hasAttribute` per evaluation; the JSDoc has said "read once at
 *   connect time" since the LT-115 cutover, and the fold needs the
 *   compiler-known server truth.
 * - "remaining" / "Well done, all done!" are catalog keys, and each
 *   category span's WORD FORM is one too (LT-190's `<key>.<category>`
 *   convention — the spans reference `{t['task.one']}` … `{t['task.other']}`
 *   directly): the noun is not "singular plus s" — Welsh tasg/tasgiau,
 *   Arabic's six forms, and English's own person/people never fit that
 *   shape. Per-INSTANCE wording ("person"/"people" for a specific page)
 *   stays page data in the light DOM; the catalog carries the component's
 *   own noun in every category it renders.
 */

import { asBoolean, asClampedInteger } from '@zeix/le-truc'
import { getLocale } from '../../_common/getLocale'

export const i18n = {
	done: 'Well done, all done!',
	remaining: 'remaining',
	'task.one': 'task',
	'task.other': 'tasks',
	// The source locale's best form per category, declared for every key the
	// template references (LT-190's no-implicit-fallback rule): English never
	// renders zero/two/few/many cardinally — 0 → other — but its ORDINAL
	// rules use two and few, and a locale whose catalog misses a suffixed
	// key falls back to THIS string, never to nothing.
	'task.zero': 'tasks',
	'task.two': 'tasks',
	'task.few': 'tasks',
	'task.many': 'tasks',
}

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
 * Reveal children by class: `.none` (0), `.some` (>0), and `.zero/.one/.two/.few/.many/.other` per CLDR plural rules.
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
		i18n: I18n
	},
)
	@{
		const pluralCategory = (
			locale: string,
			isOrdinal: boolean | undefined,
			n: number,
		) =>
			new Intl.PluralRules(
				locale,
				isOrdinal ? { type: 'ordinal' } : undefined,
			).select(n)

		// LT-191: the locale INHERITS. `lang` is a CONFIG attribute only, not
		// a reactive property — it is a built-in IDL property, so expose()
		// could never install an accessor over it anyway (`prop in this`),
		// and the thunks' `host.lang` reads the native accessor: the
		// element's OWN attribute, live. The walked effective locale
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
					<p class="some" truc:case-type={ordinal ? 'ordinal' : undefined} hidden={() => host.count === 0}>
						<span class="count">{host.count}</span>
						<span class="zero" truc:case="zero" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'zero'}>{t['task.zero']}</span>
						<span class="one" truc:case="one" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'one'}>{t['task.one']}</span>
						<span class="two" truc:case="two" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'two'}>{t['task.two']}</span>
						<span class="few" truc:case="few" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'few'}>{t['task.few']}</span>
						<span class="many" truc:case="many" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'many'}>{t['task.many']}</span>
						<span class="other" truc:case="other" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'other'}>{t['task.other']}</span>
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
