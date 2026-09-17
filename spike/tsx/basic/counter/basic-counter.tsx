/**
 * TSX spike port (LT-183) of examples/basic/counter/basic-counter.tsrx —
 * semantically identical: the `@{ }` block's statements become the function
 * body, the trailing JSX becomes the return. Setup statements and template
 * attribute order are copied verbatim; the byte-identity bar is the SERVER
 * RENDER (server.golden parity), not the source text.
 */
import { createCell } from '@zeix/le-truc'

export type BasicCounterProps = {
	/** Current counter value. Increments on each button click. */
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-counter': HTMLElement & BasicCounterProps
	}
}

/**
 * A simple click counter that increments on each button press.
 * Use it for demonstrating reactive property updates — the count
 * increments when the button is activated via mouse or keyboard.
 * The host element should contain a `<button>` and a `<span>`; the button must
 * be a real `<button>` element for keyboard activation to work.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-counter} Interactive preview and usage examples
 **/
export function BasicCounter({ start = 42 }: { start?: number }) {
	const count = createCell(start)
	expose({ count: count.get })

	return (
		<>
			<basic-counter>
				<button type="button" onClick={() => count.set(count.get() + 1)}>
					💐 <span>{count}</span>
				</button>
			</basic-counter>

			<style>{`
			basic-counter {
				display: inline-block;

				& button {
					border: 1px solid var(--color-border);
					border-radius: var(--space-xs);
					background-color: var(--color-secondary);
					padding: var(--space-xs) var(--space-s);
					cursor: pointer;
					color: var(--color-text);
					font-size: var(--font-size-m);
					line-height: var(--line-height-xs);
					transition: background-color var(--transition-short) var(--easing-inout);

					&:hover {
						background-color: var(--color-secondary-hover);
					}

					&:active {
						background-color: var(--color-secondary-active);
					}
				}
			}
			`}</style>
		</>
	)
}
