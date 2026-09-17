/**
 * TSX §4.4 synthetic fixture (LT-183, extended by the four-arm boundary):
 * the recognized ambient `boundary({ ok, nil, err, stale })` call — all arms
 * render, `hidden`-toggled by which state won at render time. `nil` is the
 * no-value-yet pending arm (the `.tsrx` `@pending` arm's exact IR);
 * `stale` is the re-fetching-WITH-retained-value arm, differentiable from
 * `nil` — the four-way split `watch()` already speaks (ADR 0029 precedence:
 * nil > err > stale > ok). Mirrors features.test.ts's `asyncComponent`
 * fixture for the three shared arms (same signal shape, same arm markup).
 */
import { deriveCell } from '@zeix/le-truc'

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
					stale: <p class="stale" data-state="stale">{data}</p>,
				})}
			</async-el>
			<style>{css`async-el { color: red }`}</style>
		</>
	)
}
