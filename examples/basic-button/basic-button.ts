import {
	asBoolean,
	asString,
	type Component,
	component,
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
	label?: HTMLSpanElement
	badge?: HTMLSpanElement
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-button': Component<BasicButtonProps>
	}
}

export default component<BasicButtonProps, BasicButtonUI>(
	'basic-button',
	{
		disabled: asBoolean(),
		label: asString(ui => ui.label?.textContent ?? ui.button.textContent),
		badge: asString(ui => ui.badge?.textContent ?? ''),
	},
	({ first }) => ({
		button: first('button', 'Add a native button as descendant.'),
		label: first('span.label'),
		badge: first('span.badge'),
	}),
	() => ({
		button: [setProperty('disabled')],
		label: [setText('label')],
		badge: [setText('badge')],
	}),
)
