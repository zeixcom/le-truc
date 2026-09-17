/**
 * TSX spike §4.4 synthetic fixture (LT-183): the async boundary through the
 * UNMODIFIED analysis — the spike spelling for `@try { ok } @pending { … }
 * @catch (e) { … }` is the recognized ambient `boundary({ ok, pending, err })`
 * call (§4.4's "recognized three-arm markup"): all three arms render,
 * `hidden`-toggled by which state won at render time, exactly the IR the
 * directive produced (mirrors features.test.ts's `asyncComponent` fixture —
 * same signal shape, same arm markup, so the pending render expectations
 * carry over).
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
					pending: <p class="loading">Loading</p>,
					err: (e: Error) => <p class="error">{e.message}</p>,
				})}
			</async-el>
			<style>{`async-el { color: red }`}</style>
		</>
	)
}
