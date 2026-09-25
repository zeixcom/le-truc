/**
 * Wave-4 migration (LT-100) of the hand-written module-catalog.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template renders what module-catalog.html authors by hand: a header
 * with the composed cart `basic-button`, and one composed `form-spinbutton`
 * per `products` entry.
 *
 * Setup is the twin's, with these changes:
 * - the mocked `checkAvailability` moves from module scope into setup (a
 *   module-scope name is not client-known, LTC005);
 * - `all('form-spinbutton')` is read inline rather than bound to a const;
 * - the cart `pass()` becomes the compose site's `truc:pass`;
 * - the product id falls back from `data-product` to the spinbutton's `name`:
 *   a compose-site `data-*` must be static, so a looped site cannot carry a
 *   per-item one (NOTES.md, LT-100). Page markup's `data-product` still wins.
 */

import { createMemo, type FactoryContext } from '@zeix/le-truc'
import { BasicButton } from '../../basic/button/basic-button.tsrx'
import { FormSpinbutton } from '../../form/spinbutton/form-spinbutton.tsrx'

declare global {
	interface HTMLElementTagNameMap {
		'module-catalog': HTMLElement
	}
}

/** Mocked backend response for a stock-availability check. */
export type Availability = {
	/** Real current stock — may be lower than the `max` the page rendered with. */
	max: number
	/** Human-readable reason for the reduction, or `''` if still fully available. */
	message: string
}

/** One catalog row: the spinbutton's `name` (the product id), its label and stock. */
export type ModuleCatalogProduct = {
	id: string
	name: string
	/**
	 * Optional hint after the name. Its `<small>` renders empty without one:
	 * a condition over a loop item is not render-time decidable (LTC005).
	 */
	note?: string
	max: number
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
export function ModuleCatalog(
	{
		title = 'Shop',
		cartLabel = '🛒 Shopping Cart',
		products,
	}: {
		title?: string
		cartLabel?: string
		products: ModuleCatalogProduct[]
	},
	{ all, first, on }: FactoryContext<Record<never, never>>,
) {
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

	// `all()` is read inline, not bound to a setup const: setup consts are
	// re-declared in the server render, where `all` does not exist (LTC046).
	// Disabled spinbuttons (e.g. sold out after the availability check below)
	// don't submit a value in a native form, so they shouldn't count here either.
	const total = createMemo(() =>
		all('form-spinbutton', 'Add spinbutton components to calculate sum from.')
			.get()
			.filter(item => !item.disabled)
			.reduce((sum, item) => sum + item.value, 0),
	)

	const button = first(
		'basic-button',
		'Add a button to go to the Shopping Cart',
	)

	on(button, 'click', async () => {
		const items = all('form-spinbutton')
			.get()
			.filter(item => item.value > 0)
		await Promise.all(
			items.map(async item => {
				const { max, message } = await checkAvailability(
					item.getAttribute('data-product') ?? item.getAttribute('name'),
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

	return (
		<>
			<module-catalog>
				<header>
					<p>{title}</p>
					<BasicButton
						label={cartLabel}
						disabled
						truc:pass={{
							disabled: () => !total.get(),
							badge: () => (total.get() > 0 ? String(total.get()) : ''),
						}}
					/>
				</header>
				<ul>
					{products.map(product => (
						<li>
							<p>
								{product.name}
								<small>{product.note ?? ''}</small>
							</p>
							<FormSpinbutton
								name={product.id}
								value={0}
								min={0}
								max={product.max}
							/>
						</li>
					))}
				</ul>
			</module-catalog>

			<style>{css`
			module-catalog {
				display: flex;
				flex-direction: column;
				gap: var(--space-l);

				> header,
				p {
					margin: 0;
				}

				& ul {
					padding: 0;
					margin: 0;
				}

				& header,
				li {
					display: flex;
					gap: var(--space-m);
					justify-content: space-between;
				}
			}
			`}</style>
		</>
	)
}
