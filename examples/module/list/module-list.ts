import {
	asInteger,
	asMethod,
	type Component,
	defineComponent,
	MissingElementError,
	on,
	pass,
} from '../../..'
import type { BasicButtonProps } from '../../basic/button/basic-button'
import type { FormTextboxProps } from '../../form/textbox/form-textbox'

export type ModuleListProps = {
	add: (process?: (item: HTMLElement) => void) => void
	delete: (key: string) => void
}

type ModuleListUI = {
	container: HTMLElement
	template: HTMLTemplateElement
	form?: HTMLFormElement | undefined
	textbox?: Component<FormTextboxProps> | undefined
	add?: Component<BasicButtonProps> | undefined
}

declare global {
	interface HTMLElementTagNameMap {
		'module-list': Component<ModuleListProps>
	}
}

const MAX_ITEMS = 1000

export default defineComponent<ModuleListProps, ModuleListUI>(
	'module-list',
	({ first, host }) => {
		const container = first('[data-container]', 'Add a container element for items.')
		const template = first('template', 'Add a template element for items.')
		const form = first('form')
		const textbox = first('form-textbox')
		const add = first('basic-button.add')

		const max = asInteger(MAX_ITEMS)(host as any, host.getAttribute('max'))

		return {
			ui: { container, template, form, textbox, add },
			props: {
				add: asMethod(() => {
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
				}),
				delete: asMethod(() => {
					host.delete = (key: string) => {
						const item = container.querySelector(`[data-key="${key}"]`)
						if (item) item.remove()
					}
				}),
			},
			effects: {
				form: on('submit', e => {
					e.preventDefault()
					const content = textbox?.value
					if (content) {
						host.add(item => {
							item.querySelector('slot')?.replaceWith(content)
						})
						textbox.clear()
					}
				}),
				add: pass({
					disabled: () =>
						(textbox && !textbox.length) || container.children.length >= max,
				}),
				host: on('click', e => {
					const { target } = e
					if (
						target instanceof HTMLElement
						&& target.closest('basic-button.delete')
					) {
						e.stopPropagation()
						target.closest('[data-key]')?.remove()
					}
				}),
			},
		}
	},
)
