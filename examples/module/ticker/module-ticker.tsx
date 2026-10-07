/**
 * The `.tsx` spelling of `module-ticker` (LT-110, ADR 0046/0047) — migrated
 * with same-commit cutover. Lives beside the `.tsrx` twin as a variant set
 * (ADR 0039) and is the served surface; the hand-written `.ts` stays as the
 * set's `.ts` twin (ruling 5). Every member declares its own
 * `HTMLElementTagNameMap` entry (s4).
 *
 * The LT-280 shape: an outer reactive list over `<tbody>` blocks, derived
 * from `tickers`'s keys in `BLOCK_SIZE` chunks — "Add 100 rows" is one
 * `tickers.splice`. Each block is a Mount Scope (ADR 0046 s1) with its own
 * `IntersectionObserver` sensor on the block root, seeded `true` so the
 * server renders every row, and a `height` state written from the observed
 * box before `visible` flips, in one `batch`. Inside, an inner list over a
 * block-local `deriveList` that is empty while the block is off-screen; the
 * placeholder is that loop's empty arm, holding the block's last height.
 *
 * `tickers` is a host-level `createList` seeded from the `rows` arg and
 * rendered only through the blocks, so the client rebuilds it through the
 * key alias (ADR 0047): `const ticker = tickers.byKey(s)!` in the inner
 * item setup, whose list keys each symbol by itself. Every field has a raw
 * site on the row — `symbol` the row's `data-key`, `open` its `data-open`,
 * `price`/`volume` the `<data value>` beside their formatted text. The
 * formatting runs in per-item `createMemo`s (LT-426), since a list-body
 * thunk cannot read the setup-level `Intl.NumberFormat` consts (LTC005).
 * `Math.random()` runs only in handlers, so no rendered site depends on it.
 *
 * The controls are composed `BasicButton`s (LT-463): the handlers are
 * `onClick` handler args (LT-461), and the toggle's live label is its
 * existing `truc:pass`. The child's own template renders the buttons'
 * markup from the args.
 */
import {
	asNumber,
	batch,
	createList,
	createMemo,
	createSensor,
	createState,
	deriveList,
	type FactoryContext,
} from '@zeix/le-truc'
import { css } from '@zeix/le-truc-compiler/macros'
import { BasicButton } from '../../basic/button/basic-button.tsrx'

export type TickerItem = {
	symbol: string
	open: number // reference price, never mutated
	price: number // current price, random-walks from open
	volume: number // cumulative volume from open
}

export type ModuleTickerProps = {
	/** Whether the ticker is actively updating prices. */
	running: boolean
	/** Fraction of symbols updated per tick (0–1). Read from the `fraction` attribute at connect time. */
	fraction: number
}

declare global {
	interface HTMLElementTagNameMap {
		'module-ticker': HTMLElement & ModuleTickerProps
	}
}

export function ModuleTicker(
	{ rows, fraction = 0.1 }: { rows?: TickerItem[]; fraction?: number },
	{ expose, first, host, watch }: FactoryContext<ModuleTickerProps>,
) {
	const BLOCK_SIZE = 100
	const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
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

	expose({
		running: true,
		fraction: asNumber(0.1),
	})

	const tickers = createList<TickerItem>(rows ?? [], {
		keyConfig: item => item.symbol,
	})
	// The chunk count spells `BLOCK_SIZE` out: a setup const in this
	// derivation would leave the client no harvest route for `blocks`
	// and route the component Simulated (LTC004).
	const blocks = deriveList(
		() =>
			Array.from({ length: Math.ceil(tickers.length / 100) }, (_, i) =>
				String(i),
			),
		{ keyConfig: id => id },
	)

	// Intentionally stupid: signal updates every 10ms, far faster than any
	// display can show. Each tick random-walks a random subset of symbols;
	// off-screen rows have no mounted item, so their updates do no DOM work.
	// The tick and the add-rows handler sit in client-only positions: the
	// server never runs them.
	watch('running', running => {
		if (!running) return
		const id = setInterval(() => {
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
		}, 10)
		return () => clearInterval(id)
	})

	return (
		<module-ticker fraction={String(fraction)}>
			<div class="controls">
				<BasicButton
					class="toggle"
					label="⏸️ Pause"
					truc:pass={{
						label: () => (host.running ? '⏸️ Pause' : '▶️ Resume'),
					}}
					onClick={() => {
						host.running = !host.running
					}}
				/>
				<BasicButton
					class="add-rows"
					label="➕ Add 100 rows"
					onClick={() => {
						// One block of fresh symbols from the bijective 3-char base-26
						// counter (AAA…ZZZ), skipping symbols already listed.
						const used = new Set(tickers.keys())
						const added: TickerItem[] = []
						for (let n = 0; added.length < BLOCK_SIZE && n < 17_576; n++) {
							const symbol =
								(ALPHA[Math.floor(n / 676) % 26] ?? 'A') +
								(ALPHA[Math.floor(n / 26) % 26] ?? 'A') +
								(ALPHA[n % 26] ?? 'A')
							if (used.has(symbol)) continue
							const price = Math.round((10 + Math.random() * 1000) * 100) / 100
							added.push({ symbol, open: price, price, volume: 0 })
						}
						tickers.splice(tickers.length, 0, ...added)
					}}
				/>
			</div>
			<table>
				<thead data-unreconciled>
					<tr>
						<th scope="col">Symbol</th>
						<th scope="col">Price (USD)</th>
						<th scope="col">Change</th>
						<th scope="col">Volume</th>
					</tr>
				</thead>
				{blocks.map((_block, b) => {
					// Per-block setup: the sensor observes the block root, and
					// measures it before flipping, so the placeholder keeps the
					// rows' height and the scrollbar stays accurate. rootMargin
					// materializes a block just before it scrolls into view.
					const start = Number(b) * BLOCK_SIZE
					const height = createState(0)
					const tbody = first('tbody', 'Render each block as a <tbody>.')
					const visible = createSensor<boolean>(
						set => {
							const io = new IntersectionObserver(
								entries => {
									const entry = entries[0]!
									batch(() => {
										height.set(entry.boundingClientRect.height)
										set(entry.isIntersecting)
									})
								},
								{ rootMargin: '400px' },
							)
							io.observe(tbody)
							return () => io.disconnect()
						},
						{ value: true }, // visible until the first callback corrects it
					)
					const symbols = deriveList(
						() =>
							visible.get()
								? [...tickers.keys()].slice(start, start + BLOCK_SIZE)
								: [],
						{ keyConfig: symbol => symbol },
					)
					return (
						<tbody>
							{symbols.length === 0 ? (
								<tr class="placeholder">
									<td
										class="spacer"
										colspan="4"
										style={() =>
											`height:${height.get()}px;padding:0;border:none`
										}
									></td>
								</tr>
							) : (
								symbols.map((_symbol, s) => {
									// Per-row setup: the key alias, and the formatted
									// texts as per-item memos (LT-426).
									const ticker = tickers.byKey(s)!
									const change = createMemo(() => {
										const { open, price } = ticker.get()
										return (price - open) / open
									})
									const priceText = createMemo(() =>
										priceFormat.format(ticker.get().price),
									)
									const changeText = createMemo(() =>
										changeFormat.format(change.get()),
									)
									const volumeText = createMemo(() =>
										volumeFormat.format(ticker.get().volume),
									)
									return (
										<tr
											data-open={() => String(ticker.get().open)}
											data-direction={() => {
												const c = change.get()
												return c > 0 ? 'up' : c < 0 ? 'down' : 'flat'
											}}
										>
											<th scope="row">{() => ticker.get().symbol}</th>
											<td class="price">
												<data
													class="price"
													value={() => String(ticker.get().price)}
												>
													{() => priceText.get()}
												</data>
											</td>
											<td class="change">{() => changeText.get()}</td>
											<td class="volume">
												<data
													class="volume"
													value={() => String(ticker.get().volume)}
												>
													{() => volumeText.get()}
												</data>
											</td>
										</tr>
									)
								})
							)}
						</tbody>
					)
				})}
			</table>

			<style>{css`
			:host {
				display: block;

				> .controls {
					display: flex;
					justify-content: flex-end;
					gap: var(--space-m);
					margin-block-end: var(--space-s);
				}

				& table {
					width: 100%;
					border-collapse: collapse;
					font-variant-numeric: tabular-nums;
				}

				& th,
				& td {
					padding-block: var(--space-xs);
					padding-inline: var(--space-s);
					border-block-end: 1px solid var(--color-border-soft, currentColor);
					text-align: end;
				}

				& th[scope="col"] {
					text-align: end;
					font-weight: normal;
					color: var(--color-text-soft, inherit);

					&:first-child {
						text-align: start;
					}
				}

				& th[scope="row"] {
					text-align: start;
					font-family: var(--font-mono, monospace);
					font-weight: bold;
				}

				/* Direction indicators on the change cell */
				& tr[data-direction="up"] .change {
					color: var(--color-positive, var(--color-green-60));
				}

				& tr[data-direction="down"] .change {
					color: var(--color-negative, var(--color-pink-60));
				}

				& tr[data-direction="flat"] .change {
					color: var(--color-text-soft, inherit);
				}
			}`}</style>
		</module-ticker>
	)
}
