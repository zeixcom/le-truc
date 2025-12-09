import {
	asInteger,
	type Component,
	defineComponent,
	MissingElementError,
	on,
	pass,
} from '../..'
import { BasicButtonProps } from '../basic-button/basic-button'
import { FormTextboxProps } from '../form-textbox/form-textbox'

export type ModuleListProps = {
	add: (process?: (item: HTMLElement) => void) => void
	delete: (key: string) => void
}

type ModuleListUI = {
	container: HTMLElement
	template: HTMLTemplateElement
	form?: HTMLFormElement
	textbox?: Component<FormTextboxProps>
	add?: Component<BasicButtonProps>
}

declare global {
	interface HTMLElementTagNameMap {
		'module-list': Component<ModuleListProps>
	}
}

const MAX_ITEMS = 1000

export default defineComponent<ModuleListProps, ModuleListUI>(
	'module-list',
	{
		add: ({ host, container, template }) => {
			let key = 0
			host.add = (process?: (item: HTMLElement) => void) => {
				const item = (template.content.cloneNode(true) as DocumentFragment)
					.firstElementChild
				if (item && item instanceof HTMLElement) {
					item.dataset.key = String(key++)
					if (process) process(item)
					container.append(item)
				} else {
					throw new MissingElementError(
						host,
						'*',
						'Template does not contain an item element.',
					)
				}
			}
		},
		delete: ({ host, container }) => {
			host.delete = (key: string) => {
				const item = container.querySelector(`[data-key="${key}"]`)
				if (item) item.remove()
			}
		},
	},
	({ first }) => ({
		container: first('[data-container]', 'Add a container element for items.'),
		template: first('template', 'Add a template element for items.'),
		form: first('form'),
		textbox: first('form-textbox'),
		add: first('basic-button.add'),
	}),
	ui => {
		const { host, container, textbox } = ui
		const max = asInteger(MAX_ITEMS)(ui, host.getAttribute('max'))

		return {
			form: [
				on('submit', ({ event }) => {
					event.preventDefault()
					const content = textbox?.value
					if (content) {
						host.add(item => {
							item.querySelector('slot')?.replaceWith(content)
						})
						textbox.clear()
					}
				}),
			],
			add: [
				pass({
					disabled: () =>
						(textbox && !textbox.length) || container.children.length >= max,
				}),
			],
			host: [
				on('click', ({ event }) => {
					const target = event.target
					if (
						target instanceof HTMLElement &&
						target?.closest('basic-button.delete')
					) {
						event.stopPropagation()
						target.closest('[data-key]')?.remove()
					}
				}),
			],
		}
	},
)
