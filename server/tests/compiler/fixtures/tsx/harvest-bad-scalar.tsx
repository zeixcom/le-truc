/**
 * LT-443 negative probe (must FAIL tsc — wired through
 * `fixtures/tsx/tsconfig.neg.json`; asserted in
 * server/tests/compiler/tsx/typecheck.test.ts): a scalar `harvest()` whose
 * parser yields the wrong type for its seed fails on the authored file —
 * as TS2769 over the overload set (the seed is no list), whose
 * matching-overload clause carries the substance.
 */
import { asString, createState } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'
import type { FactoryContext } from '@zeix/le-truc'

type Price = number

export function HarvestBadScalar(
	{ price }: { price: Price },
	{ expose }: FactoryContext<{ value: string }>,
) {
	const amount = createState(harvest(price, asString()))
	expose({ value: () => amount.get() })
	return (
		<div>
			<p class="amount">{amount}</p>
		</div>
	)
}
