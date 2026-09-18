/**
 * LT-209 negative probe (must FAIL tsc in the ORDINARY tsconfig — wired
 * through `spike/tsx/tsconfig.neg.json`; asserted in
 * server/tests/compiler/tsx/typecheck.test.ts). The precise
 * `FormFactoryContext<P>` parameter is what makes both planted errors
 * surface at native positions on the authored file — under the wide
 * ambient (`Record<string, any>`) both passed silently:
 *
 * - a typo'd `host.cout` read — `host` is `FormAssociatedElement &
 *   BadHostProps`, no `cout` member exists;
 * - a mistyped `expose()` key — `expose` is `Initializers<BadHostProps>`,
 *   so a `valuee` key (and a mistyped value) is an excess-property error:
 *   the P-drift check is free, no compiler diagnostic needed.
 */
import { asString } from '@zeix/le-truc'
import type { FormFactoryContext } from '@zeix/le-truc'

export type BadHostProps = {
	value: string
}

export const config = { formAssociated: true }

export function BadHost(
	{ label = 'x' }: { label?: string },
	{ host, expose }: FormFactoryContext<BadHostProps>,
) {
	const span = first('span', 'the span')
	expose({ valuee: asString('') })
	return (
		<div>
			<span>{label}</span>
			<span hidden={() => host.cout.length > 3}>{host.value}</span>
		</div>
	)
}
