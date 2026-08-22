/**
 * Phase 0 spike source: module-tabgroup as a single-file Le Truc server component.
 *
 * Exercises beyond basic-counter:
 * - server-side `for ... of` with `; index i` over render args (tabs)
 * - template-literal attribute expressions (`id={`trigger-${tab.id}`}`)
 * - boolean attribute dispatch (`hidden={i !== selected}` → attribute omitted when false)
 * - string-coerced ARIA attribute (`aria-selected={String(i === selected)}`)
 * - numeric attribute (`tabindex={i === selected ? 0 : -1}`)
 * - deeply nested tag-scoped CSS in the <style> block
 *
 * Render args are deliberately NOT the client props type: the client exposes a
 * read-only `selected` (aria-controls id of the active tab) and seeds ALL state
 * from the DOM at connect time; the server template receives the tab data and
 * the initially selected index.
 */
import { createState, defineComponent } from '../../../index'

export type ModuleTabgroupProps = {
	/** The `aria-controls` value of the currently selected tab (read-only). */
	readonly selected: string
}

declare global {
	interface HTMLElementTagNameMap {
		'module-tabgroup': HTMLElement & ModuleTabgroupProps
	}
}

const getAriaControls = (element: HTMLElement) =>
	element.getAttribute('aria-controls') ?? ''

const getSelected = (
	tabs: HTMLElement[],
	isCurrent: (element: HTMLElement) => boolean,
	offset = 0,
) => {
	const currentIndex = tabs.findIndex(isCurrent)
	const newIndex = (currentIndex + offset + tabs.length) % tabs.length
	return getAriaControls(tabs[newIndex]!)
}

export const client = defineComponent<ModuleTabgroupProps>(
	'module-tabgroup',
	({ all, expose, host, on, watch }) => {
		const tabs = all(
			'button[role="tab"]',
			'At least 2 tabs as children of a <[role="tablist"]> element are needed. Each tab must reference a unique id of a <[role="tabpanel"]> element.',
		)

		const isCurrentTab = (tab: HTMLButtonElement) =>
			host.selected === tab.getAttribute('aria-controls')

		// Private mutable state; expose as read-only via Memo so external code can't set it
		const selectedState = createState(
			getSelected(tabs.get(), tab => tab.ariaSelected === 'true'),
		)

		expose({ selected: selectedState.get })

		on(tabs, 'click', (_e, target) => {
			selectedState.set(getAriaControls(target))
		})
		on(tabs, 'keyup', (e, target) => {
			const key = e.key
			if (
				[
					'ArrowLeft',
					'ArrowRight',
					'ArrowUp',
					'ArrowDown',
					'Home',
					'End',
				].includes(key)
			) {
				e.preventDefault()
				e.stopPropagation()
				const tabsList = tabs.get()
				const next =
					key === 'Home'
						? getAriaControls(tabsList[0]!)
						: key === 'End'
							? getAriaControls(tabsList[tabsList.length - 1]!)
							: getSelected(
									tabsList,
									tab => tab === target,
									key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1,
								)
				tabsList.filter(tab => getAriaControls(tab) === next)[0]!.focus()
				selectedState.set(next)
			}
		})

		const panels = all(
			'[role="tabpanel"]',
			'At least 2 tabpanels are needed. Each tabpanel must have a unique id.',
		)
		watch('selected', () => {
			for (const tab of tabs.get()) {
				tab.ariaSelected = String(isCurrentTab(tab))
				tab.tabIndex = isCurrentTab(tab) ? 0 : -1
			}
			for (const panel of panels.get()) {
				panel.hidden = host.selected !== panel.id
			}
		})
	},
)

export type ModuleTabgroupTab = {
	id: string
	label: string
	content: string
}

export function ModuleTabgroup(
	{
		label = 'Tabs',
		tabs,
		selected = 0,
	}:
		{
			label?: string
			tabs: ModuleTabgroupTab[]
			selected?: number
		},
)
	@{
		<>
			<module-tabgroup>
				<div role="tablist" aria-label={label}>
					@for (const tab of tabs; index i) {
						<button
							type="button"
							role="tab"
							id={`trigger-${tab.id}`}
							aria-controls={`panel-${tab.id}`}
							aria-selected={String(i === selected)}
							tabindex={i === selected ? 0 : -1}
						>
							{tab.label}
						</button>
					}
				</div>
				@for (const tab of tabs; index i) {
					<div
						role="tabpanel"
						id={`panel-${tab.id}`}
						aria-labelledby={`trigger-${tab.id}`}
						hidden={i !== selected}
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
