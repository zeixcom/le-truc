/**
 * The `.tsrx` spelling of `module-cem-list` (LT-445) — the variant twin of
 * the served `module-cem-list.tsx` (ADR 0039); the hand-written `.ts` stays
 * as the set's `.ts` twin. Every member declares its own
 * `HTMLElementTagNameMap` entry (s4).
 *
 * The component owns no markup: the template wraps the page-authored
 * `{% cem-list %}` output as `children`. See the `.tsx` member for the
 * setup's deviations from the twin.
 */
import { createState } from '@zeix/le-truc'

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
export function ModuleCemList({ children = '' }: { children?: string })
	@{
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

		<module-cem-list>{children}

			<style>
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
			}</style>
		</module-cem-list>
	}
