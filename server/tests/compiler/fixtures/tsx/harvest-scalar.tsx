/**
 * LT-443 positive probe (typechecks clean under `fixtures/tsx/tsconfig.json`):
 * the scalar `harvest(value, parser)` overload resolves — a seed of an
 * aliased `number` accepts a `Parser<number>`, and tsc hears the marker's
 * typing on the authored file.
 */
import { asNumber, createState } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'
import type { FactoryContext } from '@zeix/le-truc'

type Price = number

export function HarvestScalar(
	{ price }: { price: Price },
	{ expose }: FactoryContext<{ value: number }>,
) {
	const amount = createState(harvest(price, asNumber()))
	expose({ value: () => amount.get() })
	return (
		<div>
			<p class="amount">{amount}</p>
		</div>
	)
}
