import { bindText, defineComponent } from '../../..'

export type BasicHelloProps = {
	/** The name to greet. Updated reactively as the user types in the input. */
	name: string
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-hello': HTMLElement & BasicHelloProps
	}
}

/**
 * A hello-world component that greets a name entered via an input field.
 */
export default defineComponent<BasicHelloProps>(
	'basic-hello',
	({ expose, first, on, watch }) => {
		const input = first('input', 'Needed to enter the name.')
		const output = first('output', 'Needed to display the name.')
		const fallback = output.textContent || ''

		expose({ name: output.textContent ?? '' })

		return [
			on(input, 'input', () => ({ name: input.value || fallback })),

			watch('name', bindText(output)),
		]
	},
)
