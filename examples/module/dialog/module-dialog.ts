import { defineComponent } from '../../..'

export type ModuleDialogProps = {
	open: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'module-dialog': HTMLElement & ModuleDialogProps
	}
}

const SCROLL_LOCK_CLASS = 'scroll-lock'

export default defineComponent<ModuleDialogProps>(
	'module-dialog',
	({ expose, first, on, watch }) => {
		const openButton = first(
			'button[aria-haspopup="dialog"]',
			'Add a button to open the dialog.',
		)
		const dialog = first('dialog', 'Add a native dialog element.')
		const closeButton = first(
			'dialog button.close',
			'Add a close button in the dialog.',
		)
		let scrollTop = 0
		let activeElement: HTMLElement | null = null

		expose({ open: false })

		return [
			on(openButton, 'click', () => ({ open: true })),
			on(closeButton, 'click', () => ({ open: false })),
			on(dialog, 'click', ({ target }) => target === dialog && { open: false }),
			on(dialog, 'keydown', e => {
				if (e.key !== 'Escape') return
				e.preventDefault()
				return { open: false }
			}),

			watch('open', open => {
				if (open) {
					scrollTop = document.documentElement.scrollTop
					activeElement = document.activeElement as HTMLElement | null
					dialog.showModal()
					document.body.classList.add(SCROLL_LOCK_CLASS)
					document.body.style.setProperty('top', `-${scrollTop}px`)
					closeButton.focus()
				} else {
					document.body.classList.remove(SCROLL_LOCK_CLASS)
					window.scrollTo({
						top: scrollTop,
						left: 0,
						behavior: 'instant',
					})
					document.body.style.removeProperty('top')
					dialog.close()
					if (activeElement) activeElement.focus()
				}
				return () => {
					document.body.classList.remove(SCROLL_LOCK_CLASS)
					document.body.style.removeProperty('top')
					dialog.close()
				}
			}),
		]
	},
)
