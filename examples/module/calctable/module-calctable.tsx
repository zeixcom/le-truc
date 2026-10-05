/**
 * The `.tsx` spelling of `module-calctable` (LT-109, ADR 0046) — migrated
 * with same-commit cutover. Lives beside the `.tsrx` twin as a variant set
 * (ADR 0039) and is the served surface; the hand-written `.ts` stays as the
 * set's `.ts` twin (ruling 5). Every member declares its own
 * `HTMLElementTagNameMap` entry (s4).
 *
 * The acceptance probe for the arg-seeded reactive list (ADR 0046 s7,
 * LT-429): `rows` seeds `createList` from server args, and the client
 * rebuilds each server-rendered row from its markup field by field — the
 * key from `data-key`, `description`/`amount`/`pricePerUnit` from their
 * canonical `value` sites on the row's inputs (a dirty-flag attribute reads
 * the live property; the `number` parsers infer, since `String(n)`
 * round-trips). The item is a Mount Scope (s1): a `MutableStore<CalcItem>`
 * whose fields are cells (s3), written by the row's own `onInput` handlers,
 * with the remove-on-zero commit going through the key (`items.remove(k)`).
 * The per-row price is a per-item `createMemo` over the item's own
 * fields (LT-426), whose raw value the composed `basic-number` formats
 * through the configured `Intl.NumberFormat` options. The clamp bounds and helper live in setup,
 * where the client module binds them (module-scope names are not
 * client-known, LTC005 — the scrollarea rule).
 *
 * The trailing entry row is the LT-186 shape: a `data-unreconciled` sibling
 * of the map inside the reconcile container, exempt from reconciliation,
 * committing a new row from its own inputs' `onChange`. Its inputs and the
 * totals cells carry the `entry`/`total` distinguishing classes the
 * structural proof demands (ADR 0045) — the item rows share the plain
 * classes.
 */
import {
	createList,
	createMemo,
	createStore,
	type FactoryContext,
	type MutableStore,
} from '@zeix/le-truc'
import { css } from '@zeix/le-truc-compiler/macros'
import { BasicNumber } from '../../basic/number/basic-number.tsrx'

export type CalcItem = {
	id: string
	description: string
	amount: number
	pricePerUnit: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-calctable': HTMLElement
	}
}

export function ModuleCalctable(
	{
		rows,
		lang = 'en',
		options = '{}',
	}: {
		rows?: CalcItem[]
		lang?: string
		options?: string
	},
	{ first }: FactoryContext<Record<never, never>>,
) {
	const MIN_AMOUNT = 0
	const MAX_AMOUNT = 100
	const MIN_PRICE = 0
	const MAX_PRICE = 1000

	const clamp = (value: number, min: number, max: number): number =>
		Math.min(max, Math.max(min, value))

	const entryDescription = first(
		'input.entry-description',
		'Add a description input to the entry row.',
	)
	const entryAmount = first(
		'input.entry-amount',
		'Add an amount input to the entry row.',
	)
	const entryPrice = first(
		'input.entry-price',
		'Add a price-per-unit input to the entry row.',
	)

	const items = createList<CalcItem, MutableStore<CalcItem>>(rows ?? [], {
		keyConfig: item => item.id,
		createItem: createStore,
	})
	// The raw per-row price derives here; the FORMATTED text composes
	// <BasicNumber> per row and in the totals cell — the compose takes the
	// locale and options as server args (its own render folds them), and the
	// per-row raw value arrives through the pass. A list body reads only the
	// item, the key, signals and `host` (LTC005's list-body face), so the
	// formatting cannot run inside the item.
	const amountTotal = createMemo(() =>
		items.get().reduce((sum, item) => sum + item.amount, 0),
	)
	const priceTotal = createMemo(() =>
		items.get().reduce((sum, item) => sum + item.amount * item.pricePerUnit, 0),
	)

	// Entry-row commit: create a new row once the `data-unreconciled` entry
	// row has description, amount, and price/unit — any of the three inputs'
	// change events attempts the commit, matching the twin's container-level
	// delegation.
	const commitEntry = () => {
		const description = entryDescription.value.trim()
		const amount = clamp(entryAmount.valueAsNumber || 0, MIN_AMOUNT, MAX_AMOUNT)
		const pricePerUnit = clamp(
			entryPrice.valueAsNumber || 0,
			MIN_PRICE,
			MAX_PRICE,
		)
		if (!description || amount === 0 || pricePerUnit === 0) return
		items.add({
			id: crypto.randomUUID(),
			description,
			amount,
			pricePerUnit,
		})
		entryDescription.value = ''
		entryAmount.value = ''
		entryPrice.value = ''
		entryDescription.focus()
	}

	return (
		<module-calctable lang={lang} options={options}>
			<table>
				<thead>
					<tr>
						<th class="description" scope="col">
							Description
						</th>
						<th class="amount" scope="col">
							Amount
						</th>
						<th class="price-per-unit" scope="col">
							Price/Unit
						</th>
						<th class="price" scope="col">
							Price
						</th>
					</tr>
				</thead>
				<tbody data-container>
					{items.map((item, k) => {
						// Per-item setup: the item body reads only its own signal
						// consts, the item, the key and host signals — never
						// host-level consts, imports or function consts (LTC005's
						// list-body face). The raw row price is a per-item memo
						// over the item's own fields (LT-426).
						const price = createMemo(
							() => item.amount.get() * item.pricePerUnit.get(),
						)
						return (
							<tr>
								<td class="description">
									<input
										type="text"
										class="description"
										value={() => item.description.get()}
										aria-label="Description"
										onInput={(e: Event) => {
											item.description.set((e.target as HTMLInputElement).value)
										}}
									/>
								</td>
								<td class="amount">
									<input
										type="number"
										class="amount"
										min="0"
										max="100"
										step="1"
										inputmode="numeric"
										value={() => String(item.amount.get())}
										aria-label="Amount"
										onInput={(e: Event) => {
											item.amount.set(
												Math.min(
													100,
													Math.max(
														0,
														(e.target as HTMLInputElement).valueAsNumber || 0,
													),
												),
											)
										}}
										onChange={(e: Event) => {
											const target = e.target as HTMLInputElement
											const amount = Math.min(
												100,
												Math.max(0, target.valueAsNumber || 0),
											)
											target.value = String(amount)
											item.amount.set(amount)
											if (amount === 0) items.remove(k)
										}}
									/>
								</td>
								<td class="price-per-unit">
									<input
										type="number"
										class="price-per-unit"
										min="0"
										max="1000"
										step="0.01"
										inputmode="decimal"
										value={() => String(item.pricePerUnit.get())}
										aria-label="Price per unit"
										onInput={(e: Event) => {
											item.pricePerUnit.set(
												Math.min(
													1000,
													Math.max(
														0,
														(e.target as HTMLInputElement).valueAsNumber || 0,
													),
												),
											)
										}}
										onChange={(e: Event) => {
											const target = e.target as HTMLInputElement
											const priceValue = Math.min(
												1000,
												Math.max(0, target.valueAsNumber || 0),
											)
											target.value = priceValue.toFixed(2)
											item.pricePerUnit.set(priceValue)
										}}
									/>
								</td>
								<td class="price">
									<BasicNumber
										value={0}
										lang={lang}
										options={options}
										truc:pass={{ value: () => price.get() }}
									/>
								</td>
							</tr>
						)
					})}
					<tr data-unreconciled>
						<td class="description">
							<input
								type="text"
								class="entry-description"
								placeholder="New item"
								aria-label="Description"
								onChange={commitEntry}
							/>
						</td>
						<td class="amount">
							<input
								type="number"
								class="entry-amount"
								min="0"
								max="100"
								step="1"
								inputmode="numeric"
								aria-label="Amount"
								onChange={commitEntry}
							/>
						</td>
						<td class="price-per-unit">
							<input
								type="number"
								class="entry-price"
								min="0"
								max="1000"
								step="0.01"
								inputmode="decimal"
								aria-label="Price per unit"
								onChange={commitEntry}
							/>
						</td>
						<td class="price"></td>
					</tr>
				</tbody>
				<tfoot>
					<tr>
						<td class="description">Total</td>
						<td class="amount-total">{() => amountTotal.get()}</td>
						<td class="price-per-unit total"></td>
						<td class="price-total">
							<BasicNumber
								class="total-price"
								value={0}
								lang={lang}
								options={options}
								truc:pass={{ value: () => priceTotal.get() }}
							/>
						</td>
					</tr>
				</tfoot>
			</table>

			<style>{css`
			:host {
				display: block;

				& .amount,
				& .price-per-unit,
				& .price,
				& .entry-amount,
				& .entry-price,
				& .amount-total,
				& .price-total {
					text-align: right;
				}

				& tbody {
					& tr:last-child {
						border-bottom-color: var(--color-border);
					}

					& td {
						vertical-align: middle;
					}

					& td.description,
					& td.amount,
					& td.price-per-unit {
						padding: 0 var(--space-xxs) 0 0;
					}

					& td.price {
						padding-block: var(--space-xxs);
					}

					& input {
						display: inline-block;
						box-sizing: border-box;
						background: var(--color-input);
						color: var(--color-text);
						border: none;
						border-radius: 0;
						padding: var(--space-xs) var(--space-s);
						font-size: var(--font-size-m);
						width: 100%;
						height: var(--input-height);

						&::placeholder {
							color: var(--color-text);
							opacity: var(--opacity-translucent);
						}

						&.amount,
						&.price-per-unit {
							text-align: right;
						}

						&:focus {
							position: relative;
							z-index: 1;
						}

						&:user-invalid {
							box-shadow: 0 0 var(--space-xxs) 2px var(--color-error-invalid);
						}

						&::-webkit-outer-spin-button,
						&::-webkit-inner-spin-button {
							-webkit-appearance: none;
							margin: 0;
						}
					}
				}

				& tfoot td {
					font-weight: var(--font-weight-bold);
					padding-block: var(--space-s);
				}
			}`}</style>
		</module-calctable>
	)
}
