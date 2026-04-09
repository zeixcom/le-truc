import { createMemo, createState, defineComponent } from '../../..'

export type ModuleTabgroupProps = {
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

export default defineComponent<ModuleTabgroupProps>(
	'module-tabgroup',
	({ all, expose, host, on, watch }) => {
		const tabs = all(
			'button[role="tab"]',
			'At least 2 tabs as children of a <[role="tablist"]> element are needed. Each tab must reference a unique id of a <[role="tabpanel"]> element.',
		)
		const panels = all(
			'[role="tabpanel"]',
			'At least 2 tabpanels are needed. Each tabpanel must have a unique id.',
		)

		const isCurrentTab = (tab: HTMLButtonElement) =>
			host.selected === tab.getAttribute('aria-controls')

		// Private mutable state; expose as read-only via Memo so external code can't set it
		const selectedState = createState(
			getSelected(tabs.get(), tab => tab.ariaSelected === 'true'),
		)

		expose({
			selected: createMemo(selectedState.get),
		})

		return [
			on(tabs, 'click', (e, target) => {
				selectedState.set(getAriaControls(target))
			}),
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
			}),
			watch('selected', () => {
				for (const tab of tabs.get()) {
					tab.ariaSelected = String(isCurrentTab(tab))
					tab.tabIndex = isCurrentTab(tab) ? 0 : -1
				}
				for (const panel of panels.get()) {
					panel.hidden = host.selected !== panel.id
				}
			}),
		]
	},
)
