/**
 * The retired `basic-pluralize` example (LT-467), kept as a compiler test
 * fixture under the tag `c-plural`: module-todo now words its own count, but
 * the shape below is the coverage the corpus lost with it — a reserved `i18n`
 * record whose client-referenced pattern nests `selectordinal` and `plural`
 * under a `select` on one argument (LT-252), a Parser-exposed `count` read on
 * the root (`{host.count}`), a presence `ordinal`, and the LT-191 walked-locale
 * materialization onto the root `lang` attribute (a built-in IDL property,
 * so a config attribute only). Its per-locale catalog is
 * `c-plural-catalog.ts` beside it; the gate-wave, i18n and diagnostics suites
 * compile it through `compileCorpus`.
 */

import { asBoolean, asClampedInteger } from '@zeix/le-truc'
import { getLocale } from '../../../../../examples/_common/getLocale'

export const i18n = {
	done: 'Well done, all done!',
	remaining: 'remaining',
	// One ICU pattern: the plural morphology lives inside the value, so each
	// locale spells exactly its own arms. `type` selects the rule set (the
	// `ordinal` prop): `selectordinal` for 1st/2nd/3rd, `plural` otherwise.
	tasks:
		'{type, select, ordinal {{count, selectordinal, one {task} other {tasks}}} other {{count, plural, one {task} other {tasks}}}}',
} as const

export type CPluralProps = {
	/** The count to pluralize. Clamped to a non-negative integer. */
	count: number
	/** Config attribute only (not a reactive property — `lang` is a built-in IDL property). BCP 47 locale tag; the element's own attribute wins, else the nearest ancestor's, else `en`. The server renders the effective locale onto it; the client materializes the walked locale at connect. */
	lang?: string
	/** Use ordinal plural rules (1st, 2nd, 3rd, ...) instead of cardinal. Presence-only; read once at connect time. */
	ordinal?: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'c-plural': HTMLElement & CPluralProps
	}
}

/**
 * Shows a count with its noun in the correct plural form for the locale.
 * The noun comes from the component's own catalog; the page supplies no word forms.
 * Use it for internationalised prose — screen readers benefit from grammatically correct output too.
 * Reveal children by class: `.none` (0), `.some` (>0); `.tasks` carries the noun, one ICU plural pattern per locale.
 *
 * @attribute {string} [lang] - Config attribute only (not a reactive property). BCP 47 locale tag; the element's own attribute wins, else the nearest ancestor's, else `en`. The server renders the effective locale onto it; the client materializes the walked locale at connect.
 * @attribute {boolean} [ordinal=false] - Use ordinal plural rules (1st, 2nd, 3rd, ...) instead of cardinal. Presence-only; read once at connect time.
 **/
export function CPlural(
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

			<c-plural {count} {lang} {ordinal}>
				<p class="none" hidden={() => host.count !== 0}>{t.done}</p>
				<p class="some" hidden={() => host.count === 0}>
					<span class="count">{host.count}</span>
					<span class="tasks">{() => t.tasks({ count: host.count, type: host.ordinal ? 'ordinal' : 'cardinal' })}</span>
					{t.remaining}
				</p>

			<style>
			:host {
				display: block;
			}</style>
			</c-plural>
	}
