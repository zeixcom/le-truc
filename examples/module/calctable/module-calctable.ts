import {
	bindText,
	createEffect,
	createList,
	createMemo,
	createStore,
	defineComponent,
	reconcile,
	type Store,
} from '../../..'
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
 * existing row's amount to 0 removes it. Currency formatting is configured via
 * the `options` attribute, parsed the same way as `<basic-number>`.
 * @demo {./docs/examples/module-calctable.html} Interactive preview and usage examples */
export default defineComponent(
	'module-calctable',
	({ first, host, on, watch }) => {
		const container = first(
			'tbody[data-container]',
			'Add a <tbody data-container> element for item rows.',
		)
		const template = first('template', 'Add a template element for rows.')
		const entryRow = first(
			'tbody[data-container] > tr[data-unreconciled]',
			'Add a trailing <tr data-unreconciled> row for entering new items.',
		)
		const amountTotalEl = first(
			'tfoot .amount',
			'Add a <tfoot> cell with class "amount" for the amount total.',
		)
		const priceTotalEl = first(
			'tfoot .price',
			'Add a <tfoot> cell with class "price" for the price total.',
		)

		const formatter = getNumberFormatter(
			getLocale(host),
			host.getAttribute('options'),
		)

		// Seed the list from server-rendered rows so reconcile() adopts them on
		// first run instead of treating them as stray unkeyed children.
		const initialItems: CalcItem[] = Array.from(
			container.querySelectorAll<HTMLElement>(':scope > tr[data-key]'),
		).map(row => {
			const description =
				row.querySelector<HTMLInputElement>('input.description')?.value ?? ''
			const amount =
				row.querySelector<HTMLInputElement>('input.amount')?.valueAsNumber ?? 0
			const pricePerUnit =
				row.querySelector<HTMLInputElement>('input.price-per-unit')
					?.valueAsNumber ?? 0
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

		// Iterate the list directly and read each item's field signals rather
		// than list.get() — list.get()/store.get() snapshots don't reliably
		// propagate nested per-field changes up through a memo.
		const amountTotal = createMemo(() => {
			let sum = 0
			for (const item of list) sum += item.amount.get()
			return sum
		})
		const priceTotal = createMemo(() => {
			let sum = 0
			for (const item of list)
				sum += item.amount.get() * item.pricePerUnit.get()
			return sum
		})

		reconcile(container, template, list, (element, item) => {
			const descriptionInput =
				element.querySelector<HTMLInputElement>('input.description')
			const amountInput =
				element.querySelector<HTMLInputElement>('input.amount')
			const priceInput = element.querySelector<HTMLInputElement>(
				'input.price-per-unit',
			)
			const priceOutput = element.querySelector<HTMLElement>('.price')
			if (descriptionInput) descriptionInput.value = item.description.get()
			if (amountInput) amountInput.value = String(item.amount.get())
			if (priceInput) priceInput.value = item.pricePerUnit.get().toFixed(2)
			if (!priceOutput) return
			return createEffect(() => {
				priceOutput.textContent = formatter.format(
					item.amount.get() * item.pricePerUnit.get(),
				)
			})
		})

		// Live sync: keep computed price and totals current as the user types.
		// Only targets existing (keyed) rows — the entry row is handled on commit.
		// Single-element on() doesn't delegate — read event.target, not the
		// second callback argument (which is always `container` here).
		on(container, 'input', e => {
			const target = e.target
			if (!(target instanceof HTMLInputElement)) return
			const row = target.closest<HTMLElement>('tr[data-key]')
			const key = row?.dataset.key
			const item = key ? list.byKey(key) : undefined
			if (!item) return
			if (target.classList.contains('description'))
				item.description.set(target.value)
			else if (target.classList.contains('amount'))
				item.amount.set(
					clamp(target.valueAsNumber || 0, MIN_AMOUNT, MAX_AMOUNT),
				)
			else if (target.classList.contains('price-per-unit'))
				item.pricePerUnit.set(
					clamp(target.valueAsNumber || 0, MIN_PRICE, MAX_PRICE),
				)
		})

		// Commit: clamp/reformat, remove zero-amount rows, and create a new row
		// from the entry row once description, amount, and price/unit are set.
		on(container, 'change', e => {
			const target = e.target
			if (!(target instanceof HTMLInputElement)) return
			const row = target.closest<HTMLElement>('tr')
			if (!row) return
			const key = row.dataset.key

			if (key) {
				const item = list.byKey(key)
				if (!item) return
				if (target.classList.contains('amount')) {
					const amount = clamp(
						target.valueAsNumber || 0,
						MIN_AMOUNT,
						MAX_AMOUNT,
					)
					target.value = String(amount)
					item.amount.set(amount)
					if (amount === 0) list.remove(key)
				} else if (target.classList.contains('price-per-unit')) {
					const price = clamp(target.valueAsNumber || 0, MIN_PRICE, MAX_PRICE)
					target.value = price.toFixed(2)
					item.pricePerUnit.set(price)
				}
				return
			}

			if (row !== entryRow) return
			const descriptionInput =
				entryRow.querySelector<HTMLInputElement>('input.description')
			const amountInput =
				entryRow.querySelector<HTMLInputElement>('input.amount')
			const priceInput = entryRow.querySelector<HTMLInputElement>(
				'input.price-per-unit',
			)
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

		watch(amountTotal, bindText(amountTotalEl))
		watch(() => formatter.format(priceTotal.get()), bindText(priceTotalEl))
	},
)
