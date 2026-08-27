/**
 * Unified-format migration: basic-hello — Parser-exposed `subject` prop kept
 * in sync from an `<input>` via the event-handler state-update shorthand
 * (`onInput={() => ({ subject: input.value || fallback })}`, the same shape
 * `form-checkbox.tsrx`'s `onChange` already proves), mirrored into the
 * `<output>` via the string-key lazy child `{host.subject}` (ADR 0023 examples
 * migration).
 *
 * Deviation from the hand-written `basic-hello.ts`: the hand-written version
 * harvests `subject`'s fallback once from the `<output>`'s own textContent.
 * TSRX's single canonical template renders `<output>` FROM `subject` itself
 * (the mirror), so the fallback becomes an ordinary default parameter value
 * instead of a DOM read.
 */

import { asString } from '@zeix/le-truc'

export type BasicHelloProps = {
	/** The subject to greet. Updated reactively as the user types in the input. */
	subject: string
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-hello': HTMLElement & BasicHelloProps
	}
}

/**
 * A hello-world component that greets a subject entered via an input field.
 * Use it as a starting point for learning Le Truc — it provides a minimal
 * example of a reactive property updating the DOM as the user types.
 * The host element should contain a `<label>`, `<input>`, and `<output>`; the input
 * must have `name="subject"` for the greeting to update reactively.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-hello} Interactive preview and usage examples
 **/
export function BasicHello({ subject = 'World' }: { subject?: string })
	@{
		const input = first('#subject', 'subject input')
		expose({ subject: asString('World') })

		<>
			<basic-hello {subject}>
				<label for="subject">Your name</label><br />
				<input
					id="subject"
					name="subject"
					type="text"
					autocomplete="given-name"
					onInput={() => ({ subject: input.value || 'World' })}
				/>
				<p>Hello, <output for="subject">{host.subject}</output>!</p>
			</basic-hello>

			<style>
			basic-hello {
				display: block;
			}
			</style>
		</>
	}
