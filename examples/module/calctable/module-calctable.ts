import {
	bindText,
	createList,
	createMemo,
	createStore,
	defineComponent,
	query,
	queryAll,
	reconcile,
	type Store,
} from '../../../index'
import { getLocale } from '../../_common/getLocale'
import { getNumberFormatter } from '../../_common/getNumberFormatter'

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

const MIN_AMOUNT = 0
const MAX_AMOUNT = 100
const MIN_PRICE = 0
const MAX_PRICE = 1000

const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value))

/**
 * An editable calculation table — description, amount, and price/unit columns
 * compute a per-row price, plus running totals in the footer. Rows are synced
 * via `reconcile()`; server-rendered `<tr data-key>` rows are adopted into the
 * initial list so they aren't stripped on first run. A trailing entry row
 * (marked `data-unreconciled`, exempt from reconciliation) creates a new row
 * once its description, amount, and price/unit are all filled; setting an
 * existing row's amount to 0 removes it. Currency formatting is parsed the
 * same way as `<basic-number>`.
 *
 * @attribute {string} [lang] - BCP 47 locale tag (e.g. `de-CH`). Falls back to the nearest ancestor's `lang` attribute, or `en` if none is set. Read once at connect time.
 * @attribute {Intl.NumberFormatOptions} [options={}] - `Intl.NumberFormat` options as a JSON object, e.g. `{"style":"currency","currency":"EUR"}`. Read once at connect time.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-calctable} Interactive preview and usage examples
 **/
export default defineComponent(
	'module-calctable',
	({ first, host, on, watch }) => {
		const formatter = getNumberFormatter(
			getLocale(host),
			host.getAttribute('options'),
		)

		// Seed the list from server-rendered rows so reconcile() adopts them on
		// first run instead of treating them as stray unkeyed children.
		const container = first(
			'tbody[data-container]',
			'Add a <tbody data-container> element for item rows.',
		)
		const initialItems: CalcItem[] = queryAll(
			container,
			':scope > tr[data-key]',
		).map(row => {
			const description = query(row, 'input.description')?.value ?? ''
			const amount = query(row, 'input.amount')?.valueAsNumber ?? 0
			const pricePerUnit = query(row, 'input.price-per-unit')?.valueAsNumber ?? 0
			return {
				id: row.dataset.key ?? '',
				description,
				amount: clamp(
					Number.isFinite(amount) ? amount : 0,
					MIN_AMOUNT,
					MAX_AMOUNT,
				),
				pricePerUnit: clamp(
					Number.isFinite(pricePerUnit) ? pricePerUnit : 0,
					MIN_PRICE,
					MAX_PRICE,
				),
			}
		})

		const list = createList<CalcItem, Store<CalcItem>>(initialItems, {
			keyConfig: item => item.id,
			createItem: createStore,
		})
		const rowPrices = list.deriveCollection(
			item => item.amount * item.pricePerUnit,
		)
		const amountTotal = createMemo(() =>
			list.get().reduce((sum, item) => sum + item.amount, 0),
		)
		const priceTotal = createMemo(() =>
			rowPrices.get().reduce((sum, price) => sum + price, 0),
		)

		const template = first('template', 'Add a template element for rows.')
		reconcile(container, template, list, (_element, item, key, first) => {
			const descriptionInput = first('input.description')
			const amountInput = first('input.amount')
			const priceInput = first('input.price-per-unit')
			const priceOutput = first('.price')
			if (descriptionInput) descriptionInput.value = item.description.get()
			if (amountInput) amountInput.value = String(item.amount.get())
			if (priceInput) priceInput.value = item.pricePerUnit.get().toFixed(2)
			const priceSignal = rowPrices.byKey(key)
			if (priceOutput && priceSignal)
				watch(priceSignal, price => {
					priceOutput.textContent = formatter.format(price)
				})

			// Live sync as the user types — per-row listeners live inside the
			// row's own scope now, so no container-level delegation or key
			// re-derivation from the DOM is needed.
			on(descriptionInput, 'input', (_e, target) => {
				item.description.set(target.value)
			})
			on(amountInput, 'input', (_e, target) => {
				item.amount.set(
					clamp(target.valueAsNumber || 0, MIN_AMOUNT, MAX_AMOUNT),
				)
			})
			on(priceInput, 'input', (_e, target) => {
				item.pricePerUnit.set(
					clamp(target.valueAsNumber || 0, MIN_PRICE, MAX_PRICE),
				)
			})

			// Per-row commit: clamp/reformat, remove zero-amount rows.
			on(amountInput, 'change', (_e, target) => {
				const amount = clamp(target.valueAsNumber || 0, MIN_AMOUNT, MAX_AMOUNT)
				target.value = String(amount)
				item.amount.set(amount)
				if (amount === 0) list.remove(key)
			})
			on(priceInput, 'change', (_e, target) => {
				const price = clamp(target.valueAsNumber || 0, MIN_PRICE, MAX_PRICE)
				target.value = price.toFixed(2)
				item.pricePerUnit.set(price)
			})
		})

		// Entry-row commit (container-scoped): create a new row once the
		// `data-unreconciled` entry row has description, amount, and price/unit.
		const entryRow = first(
			'tbody[data-container] > tr[data-unreconciled]',
			'Add a trailing <tr data-unreconciled> row for entering new items.',
		)
		on(container, 'change', ({ target }) => {
			if (!(target instanceof HTMLInputElement)) return
			const row = target.closest('tr')
			if (row !== entryRow) return

			const descriptionInput = query(entryRow, 'input.description')
			const amountInput = query(entryRow, 'input.amount')
			const priceInput = query(entryRow, 'input.price-per-unit')
			if (!descriptionInput || !amountInput || !priceInput) return

			const description = descriptionInput.value.trim()
			const amount = clamp(
				amountInput.valueAsNumber || 0,
				MIN_AMOUNT,
				MAX_AMOUNT,
			)
			const pricePerUnit = clamp(
				priceInput.valueAsNumber || 0,
				MIN_PRICE,
				MAX_PRICE,
			)
			if (!description || amount === 0 || pricePerUnit === 0) return

			list.add({
				id: crypto.randomUUID(),
				description,
				amount,
				pricePerUnit,
			})
			descriptionInput.value = ''
			amountInput.value = ''
			priceInput.value = ''
			descriptionInput.focus()
		})

		const amountTotalEl = first(
			'tfoot .amount',
			'Add a <tfoot> cell with class "amount" for the amount total.',
		)
		watch(amountTotal, bindText(amountTotalEl))

		const priceTotalEl = first(
			'tfoot .price',
			'Add a <tfoot> cell with class "price" for the price total.',
		)
		watch(() => formatter.format(priceTotal.get()), bindText(priceTotalEl))
	},
)
