import {
	asString,
	type Component,
	component,
	fromDOM,
	text,
	on,
	setText,
} from '../..'

export type BasicHelloProps = {
	name: string
}

export type BasicHelloUI = {
	input: HTMLInputElement
	output: HTMLOutputElement
}

export default component<BasicHelloProps, BasicHelloUI>({
	name: 'basic-hello',
	props: { name: asString(fromDOM({ output: text() }, '')) },
	select: ({ first }) => ({
		input: first('input', 'Needed to input the name.'),
		output: first('output', 'Needed to display the name.'),
	}),
	setup: el => {
		const fallback = el.name
		return {
			input: on('input', ({ target }) => {
				el.name = target.value || fallback
			}),
			output: setText('name'),
		}
	},
})

declare global {
	interface HTMLElementTagNameMap {
		'basic-hello': Component<BasicHelloProps>
	}
}
