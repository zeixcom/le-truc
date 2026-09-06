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
 * Contract notes (LT-173 migration of the LT-115 contract):
 * - The locale is read once at connect from the element's OWN `lang`
 *   attribute (`@attribute` contract below already said "read once at
 *   connect time" — now it is a Parser-exposed prop doing exactly that).
 *   The compiled component no longer walks ancestors: the record's
 *   effective locale renders onto the root attribute server-side, and a
 *   page that wants a specific locale sets the attribute (the reserved
 *   `i18n` parameter is ADR 0030 s7's canonical route; the ancestor walk
 *   is the hand-written twins' contract, approximated by the seeded realm).
 * - `ordinal` likewise became a Parser-exposed prop (presence) — the twin
 *   re-read `hasAttribute` per evaluation; the JSDoc has said "read once
 *   at connect time" since the LT-115 cutover, and the fold needs the
 *   compiler-known server truth.
 * - "task" / "remaining" / "Well done, all done!" are catalog keys
 *   (`export const i18n` below); the per-category span CONTENTS stay page
 *   data — a component catalog would claim per-instance wording ("person"/
 *   "people") that belongs to the page.
 */

import { asBoolean, asClampedInteger, asString } from '@zeix/le-truc'

export const i18n = {
	done: 'Well done, all done!',
	task: 'task',
	remaining: 'remaining',
}

export type BasicPluralizeProps = {
	/** The count to pluralize. Clamped to a non-negative integer. */
	count: number
	/** BCP 47 locale tag (e.g. `cy`). Read from the element's `lang` attribute once at connect time; falls back to `en`. */
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
 * @attribute {string} [lang] - BCP 47 locale tag (e.g. `ar`). Read from the element's attribute once at connect time; falls back to `en`. The server renders the effective locale onto this attribute.
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

		expose({
			count: asClampedInteger(),
			lang: asString(),
			ordinal: asBoolean(),
		})

		<>
			<basic-pluralize {count} {lang} {ordinal}>
				<p class="none" hidden={() => host.count !== 0}>{t.done}</p>
				<p class="some" truc:case-type={ordinal ? 'ordinal' : undefined} hidden={() => host.count === 0}>
					<span class="count">{host.count}</span>
					{t.task}
					<span class="zero" truc:case="zero" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'zero'}></span>
					<span class="one" truc:case="one" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'one'}></span>
					<span class="two" truc:case="two" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'two'}>s</span>
					<span class="few" truc:case="few" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'few'}>s</span>
					<span class="many" truc:case="many" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'many'}>s</span>
					<span class="other" truc:case="other" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'other'}>s</span>
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
