/**
 * Wave-4 migration (LT-445) of the hand-written module-cem-list.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The component owns no markup: the `{% cem-list %}` Markdoc tag renders the
 * filter `form-textbox` and one `card-collapsible` per declaration into the
 * page, and the template only wraps that page-authored content as
 * `children` (ADR 0024 s10, the module-scrollarea precedent). The template
 * renders no custom element, so the scope has no boundary and the sheet
 * reaches the cards' summaries and tab groups (ADR 0033 s7).
 *
 * Setup is the twin's, with these changes:
 * - the twin's `if (!filterEl) return` guard is gone (an `if` is outside the
 *   setup subset, LTC005): `on()` is a no-op on an absent target, and the
 *   handler reads the textbox it was attached to;
 * - the per-card `each()` with its captured haystack becomes ONE watch over
 *   `all('card-collapsible')`, read inline (LTC046), that re-reads each
 *   card's text content per run.
 */

import { createState, type FactoryContext } from '@zeix/le-truc'
import { css } from '@zeix/le-truc-compiler/macros'

declare global {
	interface HTMLElementTagNameMap {
		'module-cem-list': HTMLElement
	}
}

/**
 * A catalog of custom-element declarations, rendered server-side from a
 * custom-elements-manifest by the `{% cem-list %}` Markdoc tag — the client
 * receives fully-formed `card-collapsible` markup and only needs to register
 * the tag name; `card-collapsible` and `module-tabgroup` provide all the
 * interactive behavior. A `<form-textbox>` descendant filters the cards by
 * matching its value against each card's full text content (name, tag name,
 * description, and members) — a client-side layer over pre-rendered markup,
 * no re-fetching or re-rendering involved.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-cem-list} Interactive preview and usage examples
 **/
export function ModuleCemList(
	{ children = '' }: { children?: string },
	{ all, first, on, watch }: FactoryContext<Record<never, never>>,
) {
	const filterText = createState('')

	on(first('form-textbox'), 'input', (_event, textbox) => {
		filterText.set(textbox.value.trim().toLowerCase())
	})

	watch(
		() => ({ filter: filterText.get(), cards: all('card-collapsible').get() }),
		({ filter, cards }) => {
			for (const card of cards) {
				const haystack = card.textContent?.trim().toLowerCase() ?? ''
				card.hidden = !!filter && !haystack.includes(filter)
			}
		},
	)

	return (
		<module-cem-list>
			{children}

			<style>{css`
			:host {
				display: block;

				& form-textbox {
					display: block;
					margin: 0 0 var(--space-l);
				}

				& card-collapsible summary {
					flex-wrap: wrap;

					& .header {
						display: flex;
						align-items: baseline;
						gap: var(--space-s);
						flex: none;
					}
				}

				& .demo-link a {
					text-decoration: none;

					&:hover {
						text-decoration: underline;
					}
				}

				& module-tabgroup {
					display: block;
					margin: var(--space-s) 0 0;
				}
			}`}</style>
		</module-cem-list>
	)
}
