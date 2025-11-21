import { asString, type Component, component, on, read, setText } from '../..'

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
	ui => {
		const fallback = ui.component.name
		return {
			input: [
				on('input', ({ target }) => {
					ui.component.name = target.value || fallback
				}),
			],
			output: [setText('name')],
		}
	},
)
