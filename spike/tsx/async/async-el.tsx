/**
 * TSX §4.4 synthetic fixture (LT-183; three-arm boundary per LT-211):
 * the recognized ambient `boundary({ ok, nil, err })` call — all arms
 * render, `hidden`-toggled by which state won at render time. `nil` is the
 * no-value-yet pending arm (the `.tsrx` `@pending` arm's exact IR). There
 * is no stale arm: the reactive idiom for the re-fetching state is the
 * `isPending(data)` class binding beside the boundary — as an ARROW thunk,
 * the reactive spelling (a bare expression is a render-time `server` attr
 * and never updates) — which the compiler folds server-side (a fresh task
 * is pending → the class renders) and the client's watch re-fires when the
 * task settles. Mirrors features.test.ts's `asyncComponent` fixture (same
 * signal shape, same arm markup).
 */
import { deriveCell, isPending } from '@zeix/le-truc'

export function AsyncEl({}: {}) {
	const data = deriveCell(async () => 'loaded')
	expose({ data: data.get })

	return (
		<>
			<async-el>
				{boundary({
					ok: <div class="content">{data}</div>,
					nil: <p class="loading">Loading</p>,
					err: (e: Error) => <p class="error">{e.message}</p>,
				})}
				<p role="status" class={() => (isPending(data) ? 'pending' : null)}>
					status
				</p>
			</async-el>
			<style>{css`async-el { color: red }`}</style>
		</>
	)
}
