import { type Component, createEffect, defineComponent, on } from '../..'

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
	{
		open: false,
	},
	({ first }) => ({
		openButton: first(
			'button[aria-haspopup="dialog"]',
			'Add a button to open the dialog.',
		),
		dialog: first('dialog', 'Add a native dialog element.'),
		closeButton: first<HTMLButtonElement>(
			'dialog button.close',
			'Add a close button in the dialog.',
		),
	}),
	({ host, dialog }) => {
		let scrollTop = 0
		let activeElement: HTMLElement | null = null

		return {
			host: [
				() =>
					createEffect(() => {
						if (host.open) {
							scrollTop = document.documentElement.scrollTop
							activeElement = document.activeElement as HTMLElement | null
							dialog.showModal()
							document.body.classList.add(SCROLL_LOCK_CLASS)
							document.body.style.setProperty('top', `-${scrollTop}px`)
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
							host.open = false
						}
					}),
			],
			openButton: [
				on('click', () => {
					host.open = true
				}),
			],
			dialog: [
				on('click', ({ event }) => {
					if (event.target === dialog) host.open = false
				}),
				on('keydown', ({ event }) => {
					if (event.key === 'Escape') host.open = false
				}),
			],
			closeButton: [
				on('click', () => {
					host.open = false
				}),
			],
		}
	},
)
