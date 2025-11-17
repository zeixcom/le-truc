import {
	asString,
	type Component,
	component,
	getText,
	on,
	read,
	setText,
} from '../..'

type BasicHelloProps = {
	name: string
}

type BasicHelloUI = {
	input: HTMLInputElement
	output: HTMLOutputElement
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-hello': Component<BasicHelloProps, BasicHelloUI>
	}
}

export default component<BasicHelloProps, BasicHelloUI>(
	'basic-hello',
	({ first }) => ({
		input: first('input', 'Needed to enter the name.'),
		output: first('output', 'Needed to display the name.'),
	}),
	{
		name: asString(read({ output: getText() }, '')),
	},
	el => {
		const fallback = el.name
		return {
			input: [
				on('input', ({ target }) => {
					el.name = target.value || fallback
				}),
			],
			output: [setText('name')],
		}
	},
)
