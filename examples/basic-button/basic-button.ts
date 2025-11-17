import {
	asBoolean,
	asString,
	type Component,
	component,
	getText,
	read,
	setProperty,
	setText,
} from '../..'

type BasicButtonProps = {
	disabled: boolean
	label: string
	badge: string
}

type BasicButtonUI = {
	button: HTMLButtonElement
	label: HTMLSpanElement | null
	badge: HTMLSpanElement | null
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-button': Component<BasicButtonProps, BasicButtonUI>
	}
}

export default component<BasicButtonProps, BasicButtonUI>(
	'basic-button',
	({ first }) => ({
		button: first('button', 'Add a native button as descendant.'),
		label: first('span.label'),
		badge: first('span.badge'),
	}),
	{
		disabled: asBoolean(),
		label: asString(read({ label: getText(), button: getText() }, '')),
		badge: asString(read({ badge: getText() }, '')),
	},
	() => ({
		button: [setProperty('disabled')],
		label: [setText('label')],
		badge: [setText('badge')],
	}),
)
