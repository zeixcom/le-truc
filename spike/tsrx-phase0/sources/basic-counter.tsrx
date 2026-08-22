/**
 * Phase 0 spike source: basic-counter as a single-file Le Truc server component.
 *
 * Format assumptions under test (Option C, authored split):
 * - Client half: plain TypeScript, passes through the compiler untouched.
 * - Server half: an ordinary exported function with a `@{ ... }` statement
 *   container — the emitter lowers it to an HTML-string render function.
 *   The first element child of the output fragment MUST match the tag derived
 *   from the file name (compile-time contract check).
 * - Styles: today's tag-scoped CSS, verbatim in a `<style>` block (spec: the
 *   host owns scoping, class names, and registration — no hash rewriting).
 */
import { asInteger, bindText, defineComponent } from '../../../index'

export type BasicCounterProps = {
	/** Current counter value. Increments on each button click. */
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-counter': HTMLElement & BasicCounterProps
	}
}

export const client = defineComponent<BasicCounterProps>(
	'basic-counter',
	({ expose, first, host, on, watch }) => {
		const count = first('span', 'Add a span to display the count.')

		expose({ count: asInteger()(count.textContent) })

		const button = first(
			'button',
			'Add a native button element to increment the count.',
		)
		on(button, 'click', () => ({ count: host.count + 1 }))
		watch('count', bindText(count))
	},
)

export function BasicCounter({ count = 42 }: { count?: number })
	@{
		<>
			<basic-counter>
				<button type="button">
					💐 <span>{count}</span>
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
