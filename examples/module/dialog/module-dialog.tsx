/**
 * Wave-4 migration (LT-101) of the hand-written module-dialog.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template renders what module-dialog.html authors by hand, with one
 * difference: the open button is a direct `<button>` child (the sheet's
 * `> button` rule), not a composed `basic-button`. The opener must carry
 * `aria-haspopup`/`aria-controls`, which a compose site cannot pass to the
 * child's own button, and addressing that button through `first()` would
 * reach into markup the child owns (HOST_PROFILE § data account, bullet 3).
 * A page may still author the opener inside a `basic-button`; the selector
 * matches either way. `children` is the dialog's content markup.
 *
 * Setup is the twin's verbatim: every `dialog.`/`document.` call runs inside
 * `on()` handlers or the `open` watcher, never at setup time.
 */

import type { FactoryContext } from '@zeix/le-truc'

export type ModuleDialogProps = {
	/** Whether the dialog is currently open. */
	open: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'module-dialog': HTMLElement & ModuleDialogProps
	}
}

/**
 * A modal dialog with scroll-lock, focus management, and backdrop/Escape close support.
 * Use it for modal interactions — provides ARIA dialog semantics, traps keyboard focus
 * while open, and should restore focus to the trigger element when closed via Escape.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-dialog} Interactive preview and usage examples
 **/
export function ModuleDialog(
	{
		dialogId = 'dialog',
		title = 'Dialog',
		label = 'Open dialog',
		children = '',
	}: {
		/**
		 * The `<dialog>`'s id, wiring the opener's `aria-controls` and (with a
		 * `-title` suffix) the heading's `aria-labelledby` (LT-131). Unique per
		 * DOCUMENT, so it belongs to whoever places the component.
		 */
		dialogId?: string
		title?: string
		label?: string
		children?: string
	},
	{ expose, first, on, watch }: FactoryContext<ModuleDialogProps>,
) {
	const titleId = `${dialogId}-title`
	// Setup-scoped: a module-scope const is not a client-known name (LTC005).
	const SCROLL_LOCK_CLASS = 'scroll-lock'

	expose({ open: false })

	const openButton = first(
		'button[aria-haspopup="dialog"]',
		'Add a button to open the dialog.',
	)
	on(openButton, 'click', () => ({ open: true }))

	const closeButton = first('button.close', 'Add a close button in the dialog.')
	on(closeButton, 'click', () => ({ open: false }))

	const dialog = first('dialog', 'Add a native dialog element.')
	on(dialog, 'click', ({ target }) => target === dialog && { open: false })
	on(dialog, 'keydown', e => {
		if (e.key !== 'Escape') return
		e.preventDefault()
		return { open: false }
	})

	// Restore state across open/close — one const record, because a `let`
	// is outside the setup subset (LTC005).
	const restore: { scrollTop: number; activeElement: HTMLElement | null } = {
		scrollTop: 0,
		activeElement: null,
	}
	watch('open', open => {
		if (open) {
			restore.scrollTop = document.documentElement.scrollTop
			restore.activeElement = document.activeElement as HTMLElement | null
			dialog.showModal()
			document.body.classList.add(SCROLL_LOCK_CLASS)
			document.body.style.setProperty('top', `-${restore.scrollTop}px`)
			closeButton.focus()
		} else {
			document.body.classList.remove(SCROLL_LOCK_CLASS)
			window.scrollTo({
				top: restore.scrollTop,
				left: 0,
				behavior: 'instant',
			})
			document.body.style.removeProperty('top')
			dialog.close()
			if (restore.activeElement) restore.activeElement.focus()
		}
		return () => {
			document.body.classList.remove(SCROLL_LOCK_CLASS)
			document.body.style.removeProperty('top')
			dialog.close()
		}
	})

	return (
		<>
			<module-dialog>
				<button type="button" aria-haspopup="dialog" aria-controls={dialogId}>
					{label}
				</button>
				<dialog id={dialogId} aria-labelledby={titleId}>
					<header>
						<h2 id={titleId}>{title}</h2>
						<button type="button" class="close" aria-label="Close dialog">
							×
						</button>
					</header>
					<module-scrollarea orientation="vertical">
						<form method="dialog">
							<div class="content">{children}</div>
						</form>
					</module-scrollarea>
				</dialog>
			</module-dialog>

			<style>{css`
			/* Exception to scoping rule: class on body for scroll lock */
			body.scroll-lock {
				position: fixed;
				overflow-y: hidden;
			}

			module-dialog {
				display: inline-block;

				> button {
					border: 0;
					padding: 0;
					background: none;
					cursor: pointer;
					color: var(--color-text);
				}

				& dialog {
					display: none;
					flex-direction: column;
					border: 0;
					padding: 0;
					margin: auto 0;
					width: 100vw;
					max-width: 100%;
					max-height: 100dvh;
					color: var(--color-text);
					background: var(--color-background);
					opacity: var(--opacity-transparent);
					transition: opacity var(--transition-medium) var(--easing-inout);

					&::backdrop {
						backdrop-filter: blur(0);
						transition: backdrop-filter var(--transition-medium) var(--easing-inout);
						background-color: transparent;
					}
				}

				& dialog[open] {
					display: flex;
					opacity: var(--opacity-solid);

					> header {
						display: flex;
						justify-content: space-between;
						align-items: center;
						margin: 0;
						padding: 0 0 0 var(--space-l);

						> h2 {
							font-size: var(--font-size-l);
							font-weight: var(--font-weight-bold);
							margin: var(--space-s) 0;
						}

						.close {
							border: 0;
							background: none;
							cursor: pointer;
							font-size: var(--font-size-l);
							line-height: var(--line-height-xs);
							margin: var(--space-s) var(--space-s) var(--space-s) var(--space-m);
							padding: 0 0 var(--space-xxs);
							color: var(--color-primary);
							border-radius: var(--space-xxs);
							box-sizing: border-box;
							height: var(--input-height);
							width: var(--input-height);

							&:hover {
								color: var(--color-primary-hover);
							}

							&:active {
								color: var(--color-primary-active);
							}
						}
					}

					.content {
						padding: 0 var(--space-l) 0;
					}

					&::backdrop {
						backdrop-filter: blur(1rem);
						background-color: var(--color-shadow);
					}
				}
			}

			@media (min-width: 48em) {
				module-dialog dialog[open] {
					width: min(var(--content-max-width), calc(100% - 2 * var(--space-l)));
					max-height: calc(100dvh - 2rem);
					border-radius: var(--space-s);
					box-shadow: 0 0 var(--space-s) var(--color-shadow);
					margin: auto auto;
				}
			}
			`}</style>
		</>
	)
}
