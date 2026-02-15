import {
	type Component,
	createEventsSensor,
	defineComponent,
	Memo,
	read,
	setProperty,
	show,
} from '../..'

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
	return getAriaControls(tabs[newIndex])
}

export default defineComponent<ModuleTabgroupProps, ModuleTabgroupUI>(
	'module-tabgroup',
	{
		selected: createEventsSensor(
			read(
				ui => getSelected(ui.tabs.get(), tab => tab.ariaSelected === 'true'),
				'',
			),
			'tabs',
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
						const next =
							key === 'Home'
								? getAriaControls(tabs[0])
								: key === 'End'
									? getAriaControls(tabs[tabs.length - 1])
									: getSelected(
											tabs,
											tab => tab === target,
											key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1,
										)
						tabs.filter(tab => getAriaControls(tab) === next)[0].focus()
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
	({ host }) => {
		const isCurrentTab = (tab: HTMLButtonElement) =>
			host.selected === getAriaControls(tab)

		return {
			tabs: [
				setProperty('ariaSelected', target => String(isCurrentTab(target))),
				setProperty('tabIndex', target => (isCurrentTab(target) ? 0 : -1)),
			],
			panels: show(target => host.selected === target.id),
		}
	},
)
