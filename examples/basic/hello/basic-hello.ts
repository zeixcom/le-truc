import { bindText, defineComponent } from '../../../index'

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
export default defineComponent<BasicHelloProps>(
	'basic-hello',
	({ expose, first, on, watch }) => {
		const output = first('output', 'Needed to display the subject.')
		const fallback = output.textContent || ''

		expose({ subject: fallback })

		const input = first('input', 'Needed to enter the subject.')
		on(input, 'input', () => ({ subject: input.value || fallback }))
		watch('subject', bindText(output))
	},
)
