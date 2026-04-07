import { type EffectDescriptor } from '../../..'

import type { BasicButtonProps } from './basic-button'

type CopyStatus = 'success' | 'error'

const COPY_SUCCESS = 'success'
const COPY_ERROR = 'error'

export const copyToClipboard = (
	container: HTMLElement,
	button: HTMLElement & BasicButtonProps,
	messages: { [COPY_ERROR]?: string; [COPY_SUCCESS]?: string },
): EffectDescriptor =>
() => {
	const onClick = async () => {
		const label = button.label
		let status: CopyStatus = COPY_SUCCESS
		try {
			await navigator.clipboard.writeText(container.textContent?.trim() ?? '')
		} catch (err) {
			console.error(
				'Error while trying to use navigator.clipboard.writeText()',
				err,
			)
			status = COPY_ERROR
		}
		button.disabled = true
		button.label = messages[status] ?? label
		const timeoutId = setTimeout(
			() => {
				if (button.isConnected) {
					button.disabled = false
					button.label = label
				} else {
					clearTimeout(timeoutId)
				}
			},
			status === COPY_SUCCESS ? 1000 : 3000,
		)
	}
	button.addEventListener('click', onClick)
	return () => button.removeEventListener('click', onClick)
}
