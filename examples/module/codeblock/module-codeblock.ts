import { asBoolean, bindAttribute, defineComponent } from '../../..'
import type { BasicButtonProps } from '../../basic/button/basic-button'
import { copyToClipboard } from '../../basic/button/copyToClipboard'

export type ModuleCodeblockProps = {
	collapsed: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'module-codeblock': HTMLElement & ModuleCodeblockProps
	}
}

export default defineComponent<ModuleCodeblockProps>(
	'module-codeblock',
	({ expose, first, host, on, watch }) => {
		const code = first('code', 'Needed as source container to copy from.')
		const overlay = first('button.overlay')
		const copy = first('basic-button.copy')

		expose({ collapsed: asBoolean() })

		return [
			on(overlay, 'click', () => ({ collapsed: false })),
			copy
				&& copyToClipboard(code, copy as HTMLElement & BasicButtonProps, {
					success: copy.getAttribute('copy-success') || 'Copied!',
					error:
						copy.getAttribute('copy-error')
						|| 'Error trying to copy to clipboard!',
				}),

			watch('collapsed', bindAttribute(host, 'collapsed')),
		]
	},
)
