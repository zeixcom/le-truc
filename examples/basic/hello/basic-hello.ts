import { asString, type Component, defineComponent } from '../../..'

export type BasicHelloProps = {
	name: string
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-hello': Component<BasicHelloProps>
	}
}

export default defineComponent<BasicHelloProps>(
	'basic-hello',
	({ expose, first, on, run }) => {
		const input = first('input', 'Needed to enter the name.')
		const output = first('output', 'Needed to display the name.')
		const fallback = output.textContent || ''

		expose({
			name: asString(output.textContent ?? ''),
		})

		return [
			on(input, 'input', () => ({ name: input.value || fallback })),
			run('name', text => {
				output.textContent = text
			}),
		]
	},
)
