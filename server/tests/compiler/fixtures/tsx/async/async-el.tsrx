/**
 * The `.tsrx` twin of `async-el.tsx` (LT-303): the same async boundary
 * spelled `@try`/`@pending`/`@catch`. The parity suite compares the two
 * server modules byte-for-byte — the acceptance proof that `<truc:try>`
 * lowers onto the unchanged `try` IR.
 */
import { deriveCell, isPending } from '@zeix/le-truc'

export type AsyncElProps = {
	/** The async result once the task settles; empty until then. */
	data: string
}

export function AsyncEl({}: {})
	@{
		const data = deriveCell(async () => 'loaded')
		expose({ data: data.get })

		<>
			<async-el>
				@try {
					<div class="content">{data}</div>
				} @pending {
					<p class="loading">Loading</p>
				} @catch (e) {
					<p class="error">{e.message}</p>
				}
				<p role="status" class={() => (isPending(data) ? 'pending' : null)}>
					status
				</p>
			</async-el>
			<style>async-el { color: red }</style>
		</>
	}
