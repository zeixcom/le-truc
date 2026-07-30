import { createMemo, defineComponent } from '../../..'

declare global {
	interface HTMLElementTagNameMap {
		'module-catalog': HTMLElement
	}
}

/**
 * A product catalog that aggregates spinbutton quantities and passes the total to a cart button.
 * Use it as a demo of inter-component communication via `pass()` — when spinbutton
 * values change, the aggregated total updates the cart button reactively.
 * Each product row should contain a `<form-spinbutton>` for quantity input;
 * the cart button must have class `cart` for the total binding to attach.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-catalog} Interactive preview and usage examples
 **/
export default defineComponent('module-catalog', ({ all, first, pass }) => {
	const spinbuttons = all(
		'form-spinbutton',
		'Add spinbutton components to calculate sum from.',
	)
	const total = createMemo(() =>
		spinbuttons.get().reduce((sum, item) => sum + item.value, 0),
	)

	const button = first(
		'basic-button',
		'Add a button to go to the Shopping Cart',
	)
	pass(button, {
		disabled: () => !total.get(),
		badge: () => (total.get() > 0 ? String(total.get()) : ''),
	})
})
