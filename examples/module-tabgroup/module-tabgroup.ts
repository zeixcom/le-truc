import {
	type Collection,
	type Component,
	createSensor,
	defineComponent,
	read,
	setProperty,
	show,
} from '../..'

type ModuleTabgroupProps = {
	readonly selected: string
}

type ModuleTabgroupUI = {
	tabs: Collection<HTMLButtonElement>
	panels: Collection<HTMLElement>
}

declare global {
	interface HTMLElementTagNameMap {
		'module-tabgroup': Component<ModuleTabgroupProps>
	}
}

const getAriaControls = (element: HTMLElement) =>
	element.getAttribute('aria-controls') ?? ''

const getSelected = (
	elements: Collection<HTMLElement>,
	isCurrent: (element: HTMLElement) => boolean,
	offset = 0,
) =>
	getAriaControls(
		elements.get()[
			Math.min(
				Math.max(elements.get().findIndex(isCurrent) + offset, 0),
				elements.length - 1,
			)
		],
	)

export default defineComponent<ModuleTabgroupProps, ModuleTabgroupUI>(
	'module-tabgroup',
	{
		selected: createSensor(
			'tabs',
			read(
				ui => getSelected(ui.tabs, tab => tab.ariaSelected === 'true'),
				'',
			),
			{
				click: ({ target }) => getAriaControls(target),
				keyup: ({ event, ui, target }) => {
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
						const tabs = ui.tabs.get()
						const next = getSelected(
							ui.tabs,
							tab => tab === target,
							key === 'Home'
								? -tabs.length
								: key === 'End'
									? tabs.length
									: key === 'ArrowLeft' || key === 'ArrowUp'
										? -1
										: 1,
						)
						tabs.filter(
							tab => getAriaControls(tab) === next,
						)[0].focus()
						return next
					}
				},
			},
		),
	},
	({ all }) => ({
		tabs: all(
			'button[role="tab"]',
			'At least 2 tabs as children of a <[role="tablist"]> element are needed. Each tab must reference a unique id of a <[role="tabpanel"]> element.',
		),
		panels: all(
			'[role="tabpanel"]',
			'At least 2 tabpanels are needed. Each tabpanel must have a unique id.',
		),
	}),
	({ host, tabs }) => {
		const isCurrentTab = (tab: HTMLButtonElement) =>
			host.selected === getAriaControls(tab)

		return {
			tabs: [
				setProperty('ariaSelected', target =>
					String(isCurrentTab(target)),
				),
				setProperty('tabIndex', target =>
					isCurrentTab(target) ? 0 : -1,
				),
			],
			panels: [show(target => host.selected === target.id)],
		}
	},
)
