import { asBoolean, bindAttribute, defineComponent } from '@zeix/le-truc'
import { copyToClipboard } from '../../basic/button/copyToClipboard'

export type ModuleCodeblockProps = {
	/** Whether the code block is collapsed (truncated). Read from the `collapsed` attribute at connect time. */
	collapsed: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'module-codeblock': HTMLElement & ModuleCodeblockProps
	}
}

/**
 * A syntax-highlighted code block with collapsible truncation and a copy-to-clipboard button.
 * Use it for displaying code samples — provides a keyboard-accessible expand/copy
 * button and should be used when long code listings need graceful truncation.
 * The `collapsed` attribute should be set to avoid overwhelming the page with long code.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-codeblock} Interactive preview and usage examples
 **/
export default defineComponent<ModuleCodeblockProps>(
	'module-codeblock',
	({ expose, first, host, on, watch }) => {
		const code = first('code', 'Needed as source container to copy from.')

		expose({ collapsed: asBoolean() })

		const overlay = first('button.overlay')
		on(overlay, 'click', () => ({ collapsed: false }))

		const copy = first('basic-button.copy')
		if (copy)
			copyToClipboard(code, copy, {
				success: copy.getAttribute('copy-success') || 'Copied!',
				error:
					copy.getAttribute('copy-error') ||
					'Error trying to copy to clipboard!',
			})

		watch('collapsed', bindAttribute(host, 'collapsed'))
	},
)
