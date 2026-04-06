import {
	asBoolean,
	asString,
	bindProperty,
	bindText,
	defineComponent,
} from '../../..'

export type BasicButtonProps = {
	disabled: boolean
	label: string
	badge: string
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-button': HTMLElement & BasicButtonProps
	}
}

export default defineComponent<BasicButtonProps>(
	'basic-button',
	({ expose, first, watch }) => {
		const button = first('button', 'Add a native button as descendant.')
		const label = first('span.label')
		const badge = first('span.badge')

		expose({
			disabled: asBoolean(),
			label: asString(label?.textContent ?? button.textContent ?? ''),
			badge: asString(badge?.textContent ?? ''),
		})

		return [
			watch('disabled', bindProperty(button, 'disabled')),
			label && watch('label', bindText(label)),
			badge && watch('badge', bindText(badge)),
		]
	},
)
