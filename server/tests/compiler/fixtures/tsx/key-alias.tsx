/**
 * LT-453 probe (must compile clean): the key alias on the authored
 * surface. A flat host-level list, seeded from args, renders only through
 * two levels of derived grouping; each row reads it by key in item setup
 * (ADR 0047 s1), and the non-null assertion is the alias spelling tsc
 * needs, since `byKey` may miss.
 */
import { createList, deriveList, type FactoryContext } from '@zeix/le-truc'
import { css } from '@zeix/le-truc-compiler/macros'

type Ticker = { symbol: string; price: number; volume: number }

export function KeyAlias(
	{ rows = [] }: { rows?: Ticker[] },
	{ expose }: FactoryContext<{ count: number }>,
) {
	const tickers = createList<Ticker>(rows, { keyConfig: t => t.symbol })
	const sections = deriveList(
		() => [...new Set(tickers.get().map(t => t.symbol.slice(0, 1)))],
		{ keyConfig: s => s },
	)
	expose({ count: () => tickers.length })
	return (
		<div>
			<div class="sections">
				{sections.map((section, sk) => {
					const symbols = deriveList(
						() =>
							tickers
								.get()
								.filter(t => t.symbol.startsWith(sk))
								.map(t => t.symbol),
						{ keyConfig: s => s },
					)
					return (
						<div class="section">
							<h2>{() => section.get()}</h2>
							<table>
								<tbody>
									{symbols.map((_symbol, k) => {
										const ticker = tickers.byKey(k)!
										return (
											<tr>
												<th>{() => ticker.get().symbol}</th>
												<td class="price">{() => ticker.get().price}</td>
												<td class="volume">{() => ticker.get().volume}</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</div>
					)
				})}
			</div>
			<style>{css`
				:host {
					display: block;
				}
			`}</style>
		</div>
	)
}
