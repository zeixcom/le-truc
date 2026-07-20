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
 * Use it for triggering actions — it provides a native `<button>` with
 * ARIA-friendly labelling and activates on keyboard Space or Enter when focused.
 * @demo {./docs/examples/basic-button.html} Interactive preview with disabled, labelled, and badged variants
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

		watch('disabled', bindProperty(button, 'disabled'))
		if (label) watch('label', bindText(label))
		if (badge) watch('badge', bindText(badge))
	},
)
