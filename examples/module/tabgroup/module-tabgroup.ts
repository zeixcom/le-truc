import {
	type Component,
	createEventsSensor,
	defineComponent,
	type Memo,
	read,
	setProperty,
	show,
} from '../../..'

export type ModuleTabgroupProps = {
	readonly selected: string
}

type ModuleTabgroupUI = {
	tabs: Memo<HTMLButtonElement[]>
	panels: Memo<HTMLElement[]>
}

declare global {
	interface HTMLElementTagNameMap {
		'module-tabgroup': Component<ModuleTabgroupProps>
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

export default defineComponent<ModuleTabgroupProps, ModuleTabgroupUI>(
	'module-tabgroup',
	({ all, host }) => {
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

		return {
			ui: { tabs, panels },
			props: {
				selected: createEventsSensor(
					read(
						() => getSelected(tabs.get(), tab => tab.ariaSelected === 'true'),
						'',
					),
					'tabs',
					{
						click: ({ target }) => getAriaControls(target),
						keyup: ({ event, target }) => {
							const key = event.key
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
								event.preventDefault()
								event.stopPropagation()
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
								return next
							}
						},
					},
				),
			},
			effects: {
				tabs: [
					setProperty('ariaSelected', target => String(isCurrentTab(target))),
					setProperty('tabIndex', target => (isCurrentTab(target) ? 0 : -1)),
				],
				panels: show(target => host.selected === target.id),
			},
		}
	},
)
