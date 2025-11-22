import { asString, type Component, component, on, setText } from '../..'

type BasicHelloProps = {
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

export default component<BasicHelloProps, BasicHelloUI>(
	'basic-hello',
	{
		name: asString(ui => ui.output.textContent),
	},
	({ first }) => ({
		input: first('input', 'Needed to enter the name.'),
		output: first('output', 'Needed to display the name.'),
	}),
	({ host }) => {
		const fallback = host.name
		return {
			input: [
				on('input', ({ target }) => {
					host.name = target.value || fallback
				}),
			],
			output: [setText('name')],
		}
	},
)
