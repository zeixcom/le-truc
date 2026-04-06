import {
	asInteger,
	asMethod,
	defineComponent,
	MissingElementError,
} from '../../..'

export type ModuleListProps = {
	add: (process?: (item: HTMLElement) => void) => void
	delete: (key: string) => void
}

declare global {
	interface HTMLElementTagNameMap {
		'module-list': HTMLElement & ModuleListProps
	}
}

const MAX_ITEMS = 1000

export default defineComponent<ModuleListProps>(
	'module-list',
	({ expose, first, host, on, pass }) => {
		const container = first(
			'[data-container]',
			'Add a container element for items.',
		)
		const template = first('template', 'Add a template element for items.')
		const form = first('form')
		const textbox = first('form-textbox')
		const add = first('basic-button.add')

		const max = asInteger(MAX_ITEMS)({} as any, host.getAttribute('max'))

		expose({
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
		})

		return [
			form
				&& on(form, 'submit', e => {
					e.preventDefault()
					const content = textbox?.value
					if (content) {
						host.add(item => {
							item.querySelector('slot')?.replaceWith(content)
						})
						textbox.clear()
					}
				}),
			add
				&& pass(add, {
					disabled: () =>
						(textbox && !textbox.length) || container.children.length >= max,
				}),
			on(host, 'click', (e, target) => {
				if (
					target instanceof HTMLElement
					&& target.closest('basic-button.delete')
				) {
					e.stopPropagation()
					target.closest('[data-key]')?.remove()
				}
			}),
		]
	},
)
