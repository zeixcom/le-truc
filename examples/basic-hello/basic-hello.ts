import {
	asString,
	type Component,
	component,
	getText,
	on,
	read,
	setText,
} from '../..'

declare global {
	interface HTMLElementTagNameMap {
		'basic-hello': Component<
			{
				name: string
			},
			{
				input: HTMLInputElement
				output: HTMLOutputElement
			}
		>
	}
}

export default component(
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
