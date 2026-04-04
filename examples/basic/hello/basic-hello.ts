import {
	asString,
	type Component,
	defineComponent,
	on,
	setText,
} from '../../..'

export type BasicHelloProps = {
	name: string
}

type BasicHelloUI = {
	input: HTMLInputElement
	output: HTMLOutputElement
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-hello': Component<BasicHelloProps>
	}
}

export default defineComponent<BasicHelloProps, BasicHelloUI>(
	'basic-hello',
	({ first, host }) => {
		const input = first('input', 'Needed to enter the name.')
		const output = first('output', 'Needed to display the name.')
		const fallback = output.textContent || ''
		return {
			ui: { input, output },
			props: {
				name: asString(() => output.textContent),
			},
			effects: {
				input: on('input', () => ({ name: input.value || fallback })),
				output: setText('name'),
			},
		}
	},
)
