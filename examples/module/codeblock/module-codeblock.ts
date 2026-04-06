import { asBoolean, type Component, defineComponent } from '../../..'
import { copyToClipboard } from '../../basic/button/copyToClipboard'

export type ModuleCodeblockProps = {
	collapsed: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'module-codeblock': Component<ModuleCodeblockProps>
	}
}

export default defineComponent<ModuleCodeblockProps>(
	'module-codeblock',
	({ expose, first, host, on, run }) => {
		const code = first('code', 'Needed as source container to copy from.')
		const overlay = first('button.overlay')
		const copy = first('basic-button.copy')

		expose({
			collapsed: asBoolean(),
		})

		return [
			run('collapsed', collapsed => {
				host.toggleAttribute('collapsed', collapsed)
			}),
			overlay && on(overlay, 'click', () => ({ collapsed: false })),
			copy
				&& (() =>
					copyToClipboard(code, {
						success: copy.getAttribute('copy-success') || 'Copied!',
						error:
							copy.getAttribute('copy-error')
							|| 'Error trying to copy to clipboard!',
					})(host as any, copy)),
		]
	},
)
