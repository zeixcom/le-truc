import {
	asBoolean,
	type Component,
	defineComponent,
	on,
	toggleAttribute,
} from '../../..'
import type { BasicButtonProps } from '../../basic/button/basic-button'
import { copyToClipboard } from '../../basic/button/copyToClipboard'

export type ModuleCodeblockProps = {
	collapsed: boolean
}

type ModuleCodeblockUI = {
	code: HTMLElement
	overlay?: HTMLButtonElement | undefined
	copy?: Component<BasicButtonProps> | undefined
}

declare global {
	interface HTMLElementTagNameMap {
		'module-codeblock': Component<ModuleCodeblockProps>
	}
}

export default defineComponent<ModuleCodeblockProps, ModuleCodeblockUI>(
	'module-codeblock',
	({ first }) => {
		const code = first('code', 'Needed as source container to copy from.')
		const overlay = first('button.overlay')
		const copy = first('basic-button.copy')
		return {
			ui: { code, overlay, copy },
			props: { collapsed: asBoolean() },
			effects: {
				host: toggleAttribute('collapsed'),
				overlay: on('click', () => ({ collapsed: false })),
				copy: copyToClipboard(code, {
					success: copy?.getAttribute('copy-success') || 'Copied!',
					error:
						copy?.getAttribute('copy-error')
						|| 'Error trying to copy to clipboard!',
				}),
			},
		}
	},
)
