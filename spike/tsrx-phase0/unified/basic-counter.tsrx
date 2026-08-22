/**
 * Unified-format spike: basic-counter — client component GENERATED from source.
 *
 * Final convention after the 2026-08-22 refinement:
 * - ZERO imports: signal constructors (createCell, …) are auto-imported into
 *   the generated client module from '@zeix/le-truc' (v2 bridge re-exported
 *   since 2.5.1); `expose`/`host` are compiler-recognized ambient identifiers.
 * - Function inputs are server args (`start`), not client props.
 * - `expose()` declares the client interface on top of HTMLElement.
 * - Signals are declared in the server function (CE v2 name: createCell).
 * - Event handlers attach to JSX elements directly (`onClick={…}`).
 * - Reactive children: `&{signal}` (grammar-native lazy read).
 * - The client never sees `start`: it harvests `count` from the <span> the
 *   server rendered (ADR 0003 preserved).
 */
export type BasicCounterProps = {
	/** Current counter value. Increments on each button click. */
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-counter': HTMLElement & BasicCounterProps
	}
}

export function BasicCounter({ start = 42 }: { start?: number })
	@{
		const count = createCell(start)
		expose({ count: count.get })

		<>
			<basic-counter>
				<button type="button" onClick={() => count.set(count.get() + 1)}>
					💐 <span>&{count}</span>
				</button>
			</basic-counter>

			<style>
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
			</style>
		</>
	}
