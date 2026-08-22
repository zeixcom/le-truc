/**
 * Unified-format spike: module-tabgroup — exercises the hard cases.
 *
 * Beyond basic-counter:
 * - reactive ATTRIBUTE bindings as thunks (`aria-selected={() => …}`) —
 *   function-valued binding positions are reactive, grammar-native
 * - statements inside the `@for` body: server-data consts hoisted per item
 *   (`const pid = panelId(tab.id)`) and referenced by reactive thunks —
 *   this is the simplified rewrite contract: on the client the hoisted
 *   const rebinds to an element-derived value (`aria-controls`)
 * - mixed static/reactive attributes on one element
 * - keyboard handler written DOM-relative so it needs no server data
 * - a signal (`selected`) whose client seed is harvested from which tab the
 *   server marked aria-selected="true"
 */
export type ModuleTabgroupProps = {
	/** The `aria-controls` value of the currently selected tab (read-only). */
	readonly selected: string
}

declare global {
	interface HTMLElementTagNameMap {
		'module-tabgroup': HTMLElement & ModuleTabgroupProps
	}
}

export type ModuleTabgroupTab = {
	id: string
	label: string
	content: string
}

export function ModuleTabgroup(
	{
		label = 'Tabs',
		tabs,
		selected: initialSelected = 0,
	}:
		{
			label?: string
			tabs: ModuleTabgroupTab[]
			selected?: number
		},
)
	@{
		const panelId = (id: string) => `panel${id}`
		const triggerId = (id: string) => `trigger${id}`

		const selected = createCell(panelId(tabs[initialSelected]?.id ?? ''))
		expose({ selected: selected.get })

		<>
			<module-tabgroup>
				<div role="tablist" aria-label={label}>
					@for (const tab of tabs; index i) {
						const trig = triggerId(tab.id)
						const pid = panelId(tab.id)
						<button
							type="button"
							role="tab"
							id={trig}
							aria-controls={pid}
							aria-selected={() => String(selected.get() === pid)}
							tabindex={() => (selected.get() === pid ? 0 : -1)}
							onClick={() => selected.set(pid)}
							onKeyup={(e: KeyboardEvent) => {
								if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
								e.preventDefault()
								e.stopPropagation()
								// written DOM-relative: sibling tabs and their
								// aria-controls values — no server data needed
								const tablist = (e.currentTarget as HTMLElement).closest('[role="tablist"]')!
								const siblings = [...tablist.querySelectorAll<HTMLButtonElement>('button[role="tab"]')]
								const current = siblings.indexOf(e.currentTarget as HTMLButtonElement)
								const offset = e.key === 'Home'
									? -current
									: e.key === 'End'
										? siblings.length - 1 - current
										: e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1
								const next = siblings[(current + offset + siblings.length) % siblings.length]!
								next.focus()
								selected.set(next.getAttribute('aria-controls')!)
							}}
						>
							{tab.label}
						</button>
					}
				</div>
				@for (const tab of tabs; index i) {
					const pid = panelId(tab.id)
					<div
						role="tabpanel"
						id={pid}
						aria-labelledby={triggerId(tab.id)}
						hidden={() => selected.get() !== pid}
					>
						{tab.content}
					</div>
				}
			</module-tabgroup>

			<style>
			module-tabgroup {
				display: block;
				margin-block-end: var(--space-l);

				> [role="tablist"] {
					display: flex;
					border-bottom: 1px solid var(--color-border);
					padding: 0;
					margin-block-end: 0;

					> [role="tab"] {
						border: 0;
						border-top: 2px solid transparent;
						border-bottom-width: 0;
						border-radius: var(--space-xs) var(--space-xs) 0 0;
						font-family: var(--font-family-sans);
						font-size: var(--font-size-s);
						font-weight: var(--font-weight-bold);
						padding: var(--space-s) var(--space-m);
						color: var(--color-text-soft);
						background-color: var(--color-secondary);
						cursor: pointer;
						transition: all var(--transition-short) var(--easing-inout);

						&:hover,
						&:focus {
							color: var(--color-text);
							background-color: var(--color-secondary-hover);
						}

						&:focus {
							z-index: 1;
						}

						&:active {
							color: var(--color-text);
							background-color: var(--color-secondary-active);
						}

						&[aria-selected="true"] {
							color: var(--color-primary-active);
							border-top: 3px solid var(--color-primary);
							background-color: var(--color-background);
							margin-bottom: -1px;
						}
					}
				}

				> [role="tabpanel"] {
					font-size: var(--font-size-m);
					background: var(--color-background);
					margin-block-start: var(--space-l);
				}
			}
			</style>
		</>
	}
