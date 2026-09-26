/**
 * TSX spike port (LT-183) of examples/basic/pluralize/basic-pluralize.tsrx —
 * semantically identical. The `@{ }` setup becomes the function body; the
 * attribute shorthands (`{count} {lang} {ordinal}`) spell out
 * `count={count} lang={lang} ordinal={ordinal}` (same server-attr IR).
 * Setup statements are copied verbatim.
 *
 * Lives beside its `.tsrx` twin as a variant set (ADR 0039). Every member
 * declares its own `HTMLElementTagNameMap` entry (s4): the served member's
 * generated client must carry it.
 */

import type { FactoryContext } from '@zeix/le-truc'
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
	{
		count,
		lang = 'en',
		ordinal = false,
		i18n: { t },
	}: {
		count: number
		lang?: string
		ordinal?: boolean
		i18n: I18n<typeof i18n>
	},
	{ host, expose }: FactoryContext<BasicPluralizeProps>,
) {
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
		if (!host.getAttribute('lang')) host.setAttribute('lang', getLocale(host))
	}
	materializeLocale()
	expose({
		count: asClampedInteger(),
		ordinal: asBoolean(),
	})

	return (
		<>
			<basic-pluralize count={count} lang={lang} ordinal={ordinal}>
				<p class="none" hidden={() => host.count !== 0}>
					{t.done}
				</p>
				<p class="some" hidden={() => host.count === 0}>
					<span class="count">{host.count}</span>
					<span class="tasks">
						{() =>
							t.tasks({
								count: host.count,
								type: host.ordinal ? 'ordinal' : 'cardinal',
							})
						}
					</span>
					{t.remaining}
				</p>
			</basic-pluralize>

			<style>{css`
			basic-pluralize {
				display: inline;

				& .count::after {
					content: " ";
				}
			}
			`}</style>
		</>
	)
}
