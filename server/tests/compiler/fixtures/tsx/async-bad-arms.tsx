/**
 * LT-208 negative probe, respelled for `<truc:try>` (LT-303). Must FAIL tsc
 * under the typed `IntrinsicElements['truc:try']` entry — wired through
 * `fixtures/tsx/tsconfig.neg.json`; asserted in
 * server/tests/compiler/tsx/typecheck.test.ts:
 *
 * - a string in the `pending` element-arm position — the branded
 *   `JSX.Element` rejects it (the generic-`T` shape the ruling rejected
 *   would have union-absorbed this);
 * - a `catch` arrow annotated `(e: string)` reading `e.message` — the
 *   contextual `Error` parameter is what makes the mistyped annotation
 *   surface instead of silently widening;
 * - a repeated `catch` arm — attributes make arm uniqueness a tsc error
 *   (TS17001), not a compiler diagnostic.
 */
import { deriveCell } from '@zeix/le-truc'

export function AsyncBadArms({}: {}) {
	const data = deriveCell(async () => 'loaded')
	expose({ data: data.get })

	return (
		<div>
			<truc:try pending="oops" catch={(e: string) => <p>{e.message}</p>}>
				<div>{data}</div>
			</truc:try>
			<truc:try catch={e => <p>{e.message}</p>} catch={e => <p>again</p>}>
				<div>{data}</div>
			</truc:try>
		</div>
	)
}
