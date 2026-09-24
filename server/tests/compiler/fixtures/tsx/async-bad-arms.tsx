/**
 * LT-208 negative probe (must FAIL tsc under the typed boundary ambient —
 * wired through `fixtures/tsx/tsconfig.neg.json`; asserted in
 * server/tests/compiler/tsx/typecheck.test.ts):
 *
 * - a string in the `nil` element-arm position — the branded
 *   `JSX.Element` rejects it (the generic-`T` shape the ruling rejected
 *   would have union-absorbed this);
 * - an `err` arrow annotated `(e: string)` reading `e.message` — the
 *   contextual `Error` parameter is what makes the mistyped annotation
 *   surface instead of silently widening.
 */
import { deriveCell } from '@zeix/le-truc'

export function AsyncBadArms({}: {}) {
	const data = deriveCell(async () => 'loaded')
	expose({ data: data.get })

	return (
		<div>
			{boundary({
				ok: <div>{data}</div>,
				nil: 'oops',
				err: (e: string) => <p>{e.message}</p>,
			})}
		</div>
	)
}
