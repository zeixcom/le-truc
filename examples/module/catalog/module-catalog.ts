import { createMemo, defineComponent } from '../../../index'

declare global {
	interface HTMLElementTagNameMap {
		'module-catalog': HTMLElement
	}
}

/** Mocked backend response for a stock-availability check. */
type Availability = {
	/** Real current stock — may be lower than the `max` the page rendered with. */
	max: number
	/** Human-readable reason for the reduction, or `''` if still fully available. */
	message: string
}

/**
 * Mocked backend round trip: real availability may have drifted from the
 * `max` the page was rendered with (other buyers, restocking) since load.
 * Demo data: `product-2` has reduced stock, `product-3` has sold out;
 * everything else is unchanged.
 */
const checkAvailability = async (
	productId: string | null,
	requestedMax: number,
): Promise<Availability> => {
	await new Promise(resolve => setTimeout(resolve, 300))
	if (productId === 'product-2')
		return { max: 2, message: 'Only 2 left in stock' }
	if (productId === 'product-3')
		return { max: 0, message: 'No longer available' }
	return { max: requestedMax, message: '' }
}

/**
 * A product catalog that aggregates spinbutton quantities and passes the total to a cart button.
 * Use it as a demo of inter-component communication via `pass()` — when spinbutton
 * values change, the aggregated total updates the cart button reactively.
 * Each product row should contain a `<form-spinbutton data-product="…">` for quantity
 * input; the cart button must have class `cart` for the total binding to attach.
 *
 * Also demonstrates validity composition (ADR 0020): clicking the cart button
 * re-checks real availability for items in the cart and may lower a
 * spinbutton's `max` — an internally-derived `rangeOverflow` typed flag the
 * spinbutton computes itself — while separately explaining why via
 * `setCustomValidity()`, an externally-set `customError`. Both coexist on the
 * same `internals` without either clobbering the other, as long as `max` is
 * assigned *before* `setCustomValidity()` — reversing the order would let the
 * `customError` merge onto a stale `rangeOverflow`, or (if the spinbutton's
 * own watch fired later) get wiped by it. See `form-spinbutton.ts` for the
 * corresponding half of this composition. A sold-out item (`max: 0`) also
 * gets `disabled` set, which `form-spinbutton`'s `fieldset` cascades to its
 * increment/decrement/input controls natively.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-catalog} Interactive preview and usage examples
 **/
export default defineComponent('module-catalog', ({ all, first, on, pass }) => {
	const spinbuttons = all(
		'form-spinbutton',
		'Add spinbutton components to calculate sum from.',
	)
	// Disabled spinbuttons (e.g. sold out after the availability check below)
	// don't submit a value in a native form, so they shouldn't count here either.
	const total = createMemo(() =>
		spinbuttons
			.get()
			.filter(item => !item.disabled)
			.reduce((sum, item) => sum + item.value, 0),
	)

	const button = first(
		'basic-button',
		'Add a button to go to the Shopping Cart',
	)
	pass(button, {
		disabled: () => !total.get(),
		badge: () => (total.get() > 0 ? String(total.get()) : ''),
	})

	on(button, 'click', async () => {
		const items = spinbuttons.get().filter(item => item.value > 0)
		await Promise.all(
			items.map(async item => {
				const { max, message } = await checkAvailability(
					item.getAttribute('data-product'),
					item.max,
				)
				item.max = max
				item.disabled = max === 0
				// Only surface the reason when the reduced max actually
				// invalidates the current quantity — a cart quantity that
				// still fits the new max shouldn't show a stock warning.
				item.setCustomValidity(item.value > max ? message : '')
			}),
		)
	})
})
