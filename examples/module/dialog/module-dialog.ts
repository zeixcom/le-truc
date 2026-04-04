import { type Component, createEffect, defineComponent, on } from '../../..'

export type ModuleDialogProps = {
	open: boolean
}

type ModuleDialogUI = {
	openButton: HTMLButtonElement
	dialog: HTMLDialogElement
	closeButton: HTMLButtonElement
}

declare global {
	interface HTMLElementTagNameMap {
		'module-dialog': Component<ModuleDialogProps>
	}
}

const SCROLL_LOCK_CLASS = 'scroll-lock'

export default defineComponent<ModuleDialogProps, ModuleDialogUI>(
	'module-dialog',
	({ first, host }) => {
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
		return {
			ui: { openButton, dialog, closeButton },
			props: { open: false },
			effects: {
				host: () =>
					createEffect(() => {
						if (host.open) {
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
				openButton: on('click', () => ({ open: true })),
				closeButton: on('click', () => ({ open: false })),
				dialog: [
					on('click', ({ target }) => {
						if (target === dialog) host.open = false
					}),
					on('keydown', ({ key }) => {
						if (key === 'Escape') host.open = false
					}),
				],
			},
		}
	},
)
