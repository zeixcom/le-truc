import { bindProperty, bindText, defineComponent } from '../../..'

export type BasicButtonProps = {
	/** Whether the button is disabled. */
	disabled: boolean
	/** Visible label text of the button. */
	label: string
	/** Optional badge text displayed alongside the label. */
	badge: string
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-button': HTMLElement & BasicButtonProps
	}
}

/**
 * A button that can be disabled, labelled, and badged via reactive properties.
 */
export default defineComponent<BasicButtonProps>(
	'basic-button',
	({ expose, first, watch }) => {
		const button = first('button', 'Add a native button as descendant.')
		const label = first('span.label')
		const badge = first('span.badge')

		expose({
			disabled: button.disabled,
			label: label?.textContent ?? button.textContent ?? '',
			badge: badge?.textContent ?? '',
		})

		return [
			watch('disabled', bindProperty(button, 'disabled')),
			label && watch('label', bindText(label)),
			badge && watch('badge', bindText(badge)),
		]
	},
)
