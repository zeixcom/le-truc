import {
	asBoolean,
	asString,
	type Component,
	defineComponent,
	setProperty,
	setText,
} from '../../..'

export type BasicButtonProps = {
	disabled: boolean
	label: string
	badge: string
}

type BasicButtonUI = {
	button: HTMLButtonElement
	label?: HTMLSpanElement | undefined
	badge?: HTMLSpanElement | undefined
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-button': Component<BasicButtonProps>
	}
}

export default defineComponent<BasicButtonProps, BasicButtonUI>(
	'basic-button',
	({ first }) => {
		const button = first('button', 'Add a native button as descendant.')
		const label = first('span.label')
		const badge = first('span.badge')
		return {
			ui: { button, label, badge },
			props: {
				disabled: asBoolean(),
				label: asString(() => label?.textContent ?? button.textContent),
				badge: asString(() => badge?.textContent ?? ''),
			},
			effects: {
				button: setProperty('disabled'),
				label: setText('label'),
				badge: setText('badge'),
			},
		}
	},
)
