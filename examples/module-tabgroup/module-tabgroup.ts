import { type Component, component, on, setProperty, show } from '../..'

type ModuleTabgroupProps = {
	readonly ui: {
		readonly tabs: HTMLButtonElement[]
		readonly panels: HTMLElement[]
	}
	selected: string
}

declare global {
	interface HTMLElementTagNameMap {
		'module-tabgroup': Component<ModuleTabgroupProps>
	}
}

const getAriaControls = (element: HTMLElement) =>
	element.getAttribute('aria-controls') ?? ''

const getSelected = (
	elements: HTMLElement[],
	isCurrent: (element: HTMLElement) => boolean,
	offset = 0,
) =>
	getAriaControls(
		elements[
			Math.min(
				Math.max(elements.findIndex(isCurrent) + offset, 0),
				elements.length - 1,
			)
		],
	)

export default component<ModuleTabgroupProps>(
	'module-tabgroup',
	{
		ui: ({ all }) => ({
			tabs: all(
				'button[role="tab"]',
				'At least 2 tabs as children of a <[role="tablist"]> element are needed. Each tab must reference a unique id of a <[role="tabpanel"]> element.',
			),
			panels: all(
				'[role="tabpanel"]',
				'At least 2 tabpanels are needed. Each tabpanel must have a unique id.',
			),
		}),
		selected: el =>
			getSelected(el.ui.tabs, tab => tab.ariaSelected === 'true'),
	},
	el => {
		const isCurrentTab = (tab: HTMLButtonElement) =>
			el.selected === getAriaControls(tab)

		return {
			tabs: [
				setProperty('ariaSelected', target =>
					String(isCurrentTab(target)),
				),
				setProperty('tabIndex', target =>
					isCurrentTab(target) ? 0 : -1,
				),
				on('click', ({ target }) => {
					el.selected = getAriaControls(target)
				}),
				on('keyup', ({ event, target }) => {
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
						const tabsCount = el.ui.tabs.length
						const current = getSelected(
							el.ui.tabs,
							tab => tab === target,
							key === 'Home'
								? -tabsCount
								: key === 'End'
									? tabsCount
									: key === 'ArrowLeft' || key === 'ArrowUp'
										? -1
										: 1,
						)
						el.ui.tabs
							.filter(tab => getAriaControls(tab) === current)[0]
							.focus()
						el.selected = current
					}
				}),
			],
			panels: [show(target => el.selected === target.id)],
		}
	},
)
