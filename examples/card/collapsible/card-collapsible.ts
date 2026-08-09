import { bindProperty, defineComponent } from '../../../index'

export type CardCollapsibleProps = {
	/** Whether the card is expanded. Reflects the descendant `<details>` element's `open` state. */
	open: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'card-collapsible': HTMLElement & CardCollapsibleProps
	}
}

/**
 * A collapsible card wrapping a native `<details>`/`<summary>` element.
 * Use it for any content that should be expandable/collapsible — content-agnostic,
 * the header goes in `<summary>`, the body is the rest of `<details>`'s content.
 * Native disclosure semantics provide keyboard toggling (Enter/Space on the summary)
 * and find-in-page support for free; the `open` reactive property mirrors the
 * descendant `<details>` element's `open` state for programmatic read/control.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#card-collapsible} Interactive preview and usage examples
 **/
export default defineComponent<CardCollapsibleProps>(
	'card-collapsible',
	({ expose, first, on, watch }) => {
		const details = first('details', 'Add a native <details> element.')

		expose({ open: details.open })

		on(details, 'toggle', () => ({ open: details.open }))

		watch('open', bindProperty(details, 'open'))
	},
)
