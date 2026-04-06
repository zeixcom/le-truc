import { asBoolean, asString, type Component, defineComponent } from '../../..'

export type BasicButtonProps = {
	disabled: boolean
	label: string
	badge: string
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-button': Component<BasicButtonProps>
	}
}

export default defineComponent<BasicButtonProps>(
	'basic-button',
	({ expose, first, run }) => {
		const button = first('button', 'Add a native button as descendant.')
		const label = first('span.label')
		const badge = first('span.badge')

		expose({
			disabled: asBoolean(),
			label: asString(label?.textContent ?? button.textContent ?? ''),
			badge: asString(badge?.textContent ?? ''),
		})

		return [
			run('disabled', value => {
				button.disabled = value
			}),
			label && run('label', text => {
				label.textContent = text
			}),
			badge && run('badge', text => {
				badge.textContent = text
			}),
		]
	},
)
