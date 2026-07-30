import { createState, defineComponent, each } from '../../..'

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
export default defineComponent(
	'module-cem-list',
	({ all, first, on, watch }) => {
		const filterEl = first('form-textbox')
		if (!filterEl) return

		const filterText = createState('')
		on(filterEl, 'input', e => {
			filterText.set((e.target as HTMLInputElement).value.trim().toLowerCase())
		})

		const cards = all('card-collapsible')
		each(cards, card => {
			const haystack = card.textContent?.trim().toLowerCase() ?? ''
			watch(filterText, filter => {
				card.hidden = !!filter && !haystack.includes(filter)
			})
		})
	},
)
