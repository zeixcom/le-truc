import {
	asNumber,
	bindProperty,
	bindText,
	createList,
	createMemo,
	defineComponent,
	each,
} from '../../..'

/* === Fantasy symbol generator === */

// Bijective 3-char base-26 counter → 17,576 unique symbols (AAA…ZZZ)
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
let _symIdx = 0
const _usedSymbols = new Set<string>()

function nextSymbol(): string {
	while (true) {
		const n = _symIdx++
		const sym =
			(ALPHA[Math.floor(n / 676) % 26] ?? 'A') +
			(ALPHA[Math.floor(n / 26) % 26] ?? 'A') +
			(ALPHA[n % 26] ?? 'A')
		if (!_usedSymbols.has(sym)) {
			_usedSymbols.add(sym)
			return sym
		}
	}
}

/* === Types === */

type TickerItem = {
	symbol: string
	open: number // reference price, never mutated
	price: number // current price, random-walks from open
	volume: number // cumulative volume from open
}

export type ModuleTickerProps = {
	running: boolean
	fraction: number
}

/* === Global Declaration === */

declare global {
	interface HTMLElementTagNameMap {
		'module-ticker': HTMLElement & ModuleTickerProps
	}
}

const priceFormat = new Intl.NumberFormat('en-US', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
})
const changeFormat = new Intl.NumberFormat('en-US', {
	style: 'percent',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	signDisplay: 'always',
})
const volumeFormat = new Intl.NumberFormat('en-US', { notation: 'compact' })

const BLOCK_SIZE = 100

/* === Component === */

export default defineComponent<ModuleTickerProps>(
	'module-ticker',
	({ all, expose, first, host, on, pass, watch }) => {
		const toggleBtn = first('basic-button.toggle')
		const addRowsBtn = first('basic-button.add-rows')
		const template = first('template') as HTMLTemplateElement | null
		const table = host.querySelector('table')
		const rows = all('tr[data-symbol]')

		// Read initial state from server-rendered HTML rows
		const initial: TickerItem[] = Array.from(
			host.querySelectorAll<HTMLTableRowElement>('tr[data-symbol]'),
		).map(row => {
			const symbol = row.dataset.symbol ?? ''
			// Seed usedSymbols so generated symbols never collide with static ones
			_usedSymbols.add(symbol)
			const price = parseFloat(
				(row.querySelector('.price')?.textContent ?? '0').replace(/,/g, ''),
			)
			return { symbol, open: price, price, volume: 0 }
		})

		// Closure-held reactive list, keyed by symbol.
		// Each item is an independent State<TickerItem>; update() on a key
		// only re-runs effects that depend on that item's signal.
		const tickers = createList<TickerItem>(initial, {
			keyConfig: item => item.symbol,
		})

		// Block registry: each <tbody> holds BLOCK_SIZE rows (materialized) or
		// a single placeholder <tr> (virtualized). The Map tracks which symbols
		// belong to each block so we can re-clone rows on materialization.
		const blockSymbols = new Map<HTMLTableSectionElement, string[]>()
		const block0 = host.querySelector('tbody') as HTMLTableSectionElement | null
		if (block0)
			blockSymbols.set(
				block0,
				initial.map(i => i.symbol),
			)

		// Materialize: remove placeholder, re-clone rows from template with
		// current price from tickers list (which kept ticking while off-screen).
		function materializeBlock(tbody: HTMLTableSectionElement): void {
			const symbols = blockSymbols.get(tbody)
			if (!symbols || !template) return
			tbody.innerHTML = ''
			const fragment = document.createDocumentFragment()
			for (const symbol of symbols) {
				const price = tickers.byKey(symbol)?.get().price ?? 0
				const clone = template.content.cloneNode(true) as DocumentFragment
				const tr = clone.firstElementChild as HTMLTableRowElement
				tr.dataset.symbol = symbol
				const th = tr.querySelector('th')
				const priceEl = tr.querySelector('.price')
				if (th) th.textContent = symbol
				if (priceEl) priceEl.textContent = priceFormat.format(price)
				fragment.append(tr)
			}
			tbody.append(fragment)
			// each(rows, …) picks up the new tr[data-symbol] rows via
			// MutationObserver and wires watch effects for them automatically.
		}

		// Virtualize: measure block height, replace all rows with a single
		// height-matched placeholder so the scrollbar stays accurate.
		function virtualizeBlock(tbody: HTMLTableSectionElement): void {
			const height = tbody.offsetHeight
			tbody.innerHTML = `<tr><td colspan="4" style="height:${height}px;padding:0;border:none"></td></tr>`
			// Removing tr[data-symbol] rows triggers the MutationObserver;
			// each(rows, …) tears down their watch effects automatically.
		}

		// One shared IntersectionObserver for all blocks. rootMargin pre-loads
		// blocks just before they scroll into view, hiding the swap latency.
		const blockObserver = new IntersectionObserver(
			entries => {
				for (const entry of entries) {
					const tbody = entry.target as HTMLTableSectionElement
					const isVirtualized = !tbody.querySelector('tr[data-symbol]')
					if (entry.isIntersecting && isVirtualized) materializeBlock(tbody)
					else if (!entry.isIntersecting && !isVirtualized)
						virtualizeBlock(tbody)
				}
			},
			{ rootMargin: '400px' },
		)

		if (block0) blockObserver.observe(block0)

		// Random-walk tick: updates a random subset of symbols each interval.
		// Virtualized rows have no active watch effects, so signal updates for
		// them are cheap (no downstream DOM work until the block re-materializes).
		const tick = () => {
			for (const key of tickers.keys()) {
				if (Math.random() >= host.fraction) continue
				tickers.byKey(key)?.update(prev => ({
					...prev,
					price: Math.max(
						0.01,
						prev.price + (Math.random() - 0.5) * prev.price * 0.004,
					),
					volume: Math.max(0, prev.volume + Math.round(Math.random() * 50_000)),
				}))
			}
		}

		expose({
			running: true,
			fraction: asNumber(0.1),
		})

		return [
			// Disconnect the block observer when the component disconnects.
			() => () => blockObserver.disconnect(),

			on(toggleBtn, 'click', () => ({ running: !host.running })),
			pass(toggleBtn, {
				label: () => (host.running ? '⏸️ Pause' : '▶️ Resume'),
			}),

			// Intentionally stupid: signal updates every 10ms, far faster than
			// any display can show.
			watch('running', v => {
				if (!v) return
				const id = setInterval(tick, 10)
				return () => clearInterval(id)
			}),

			// Per-row effects: only wired for materialized rows (tr[data-symbol]
			// in DOM). each() auto-tears-down when a row is virtualized and
			// auto-sets-up when it re-materializes. The row.isConnected guard
			// covers the brief window between DOM removal and MutationObserver
			// firing where the row is detached but the effect hasn't cleaned up.
			each(rows, row => {
				const symbol = row.dataset.symbol ?? ''
				const item = tickers.byKey(symbol)
				if (!item || !row.isConnected) return

				const priceEl = row.querySelector('.price')
				const changeEl = row.querySelector('.change')
				const volumeEl = row.querySelector('.volume')
				if (!priceEl || !changeEl || !volumeEl) return

				const changeMemo = createMemo(() => {
					const { open, price } = item.get()
					return (price - open) / open
				})

				return [
					watch(() => priceFormat.format(item.get().price), bindText(priceEl)),
					watch(
						() => changeFormat.format(changeMemo.get()),
						bindText(changeEl),
					),
					watch(
						() => {
							const change = changeMemo.get()
							return change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
						},
						bindProperty(row.dataset, 'direction'),
					),
					watch(
						() => volumeFormat.format(item.get().volume),
						bindText(volumeEl),
					),
				]
			}),

			// Batch-add one full block: update tickers list first so each() finds
			// the new State signals when the MutationObserver fires for the
			// newly appended template clones. Each click creates its own <tbody>
			// so the IntersectionObserver can virtualize it independently.
			on(addRowsBtn, 'click', () => {
				if (!template || !table) return
				const newItems: TickerItem[] = Array.from(
					{ length: BLOCK_SIZE },
					() => {
						const symbol = nextSymbol()
						const price = Math.round((10 + Math.random() * 1000) * 100) / 100
						return { symbol, open: price, price, volume: 0 }
					},
				)
				// Batch data update first — each() will find byKey() populated
				// when the MutationObserver fires for the new rows.
				tickers.splice(tickers.length, 0, ...newItems)
				const newTbody = document.createElement('tbody')
				blockSymbols.set(
					newTbody,
					newItems.map(i => i.symbol),
				)
				const fragment = document.createDocumentFragment()
				for (const { symbol, price } of newItems) {
					const clone = template.content.cloneNode(true) as DocumentFragment
					const tr = clone.firstElementChild as HTMLTableRowElement
					tr.dataset.symbol = symbol
					const th = tr.querySelector('th')
					const priceEl = tr.querySelector('.price')
					if (th) th.textContent = symbol
					if (priceEl) priceEl.textContent = priceFormat.format(price)
					fragment.append(tr)
				}
				newTbody.append(fragment)
				table.append(newTbody)
				// Start observing — if the new block is off-screen the observer
				// will fire immediately and virtualize it.
				blockObserver.observe(newTbody)
			}),
		]
	},
)
