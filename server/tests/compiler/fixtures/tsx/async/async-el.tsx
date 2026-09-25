/**
 * TSX §4.4 synthetic fixture (LT-183; three-arm boundary per LT-211,
 * spelled `<truc:try pending catch>` per ADR 0041 / LT-303): all arms
 * render, `hidden`-toggled by which state won at render time. `pending` is
 * the no-value-yet arm (the `.tsrx` `@pending` arm's exact IR). There
 * is no stale arm: the reactive idiom for the re-fetching state is the
 * `isPending(data)` class binding beside the boundary — as an ARROW thunk,
 * the reactive spelling (a bare expression is a render-time `server` attr
 * and never updates) — which the compiler folds server-side (a fresh task
 * is pending → the class renders) and the client's watch re-fires when the
 * task settles. Mirrors features.test.ts's `asyncComponent` fixture (same
 * signal shape, same arm markup); `async-el.tsrx` is its byte-parity twin.
 */
import { deriveCell, isPending } from '@zeix/le-truc'
import type { FactoryContext } from '@zeix/le-truc'

export type AsyncElProps = {
	/** The async result once the task settles; empty until then. */
	data: string
}

export function AsyncEl(
	{}: {},
	{ expose }: FactoryContext<AsyncElProps>,
) {
	const data = deriveCell(async () => 'loaded')
	expose({ data: data.get })

	return (
		<>
			<async-el>
				<truc:try
					pending={<p class="loading">Loading</p>}
					catch={e => <p class="error">{e.message}</p>}
				>
					<div class="content">{data}</div>
				</truc:try>
				<p role="status" class={() => (isPending(data) ? 'pending' : null)}>
					status
				</p>
			</async-el>
			<style>{css`async-el { color: red }`}</style>
		</>
	)
}
