import {
	type Component,
	createElementsMemo,
	defineComponent,
	on,
	pass,
	setAttribute,
} from '../../..'
import type { BasicButtonProps } from '../../basic/button/basic-button'
import type { BasicPluralizeProps } from '../../basic/pluralize/basic-pluralize'
import type { FormRadiogroupProps } from '../../form/radiogroup/form-radiogroup'
import type { FormTextboxProps } from '../../form/textbox/form-textbox'
import type { ModuleListProps } from '../list/module-list'

type ModuleTodoUI = {
	form: HTMLFormElement
	textbox: Component<FormTextboxProps>
	submit: Component<BasicButtonProps>
	list: Component<ModuleListProps>
	count: Component<BasicPluralizeProps>
	filter: Component<FormRadiogroupProps>
	clearCompleted: Component<BasicButtonProps>
}

declare global {
	interface HTMLElementTagNameMap {
		'module-todo': Component<{}>
	}
}

export default defineComponent<{}, ModuleTodoUI>(
	'module-todo',
	({ first }) => {
		const form = first('form', 'Add a form element to enter a new todo item.')
		const textbox = first(
			'form-textbox',
			'Add <form-textbox> component to enter a new todo item.',
		)
		const submit = first(
			'basic-button.submit',
			'Add <basic-button.submit> component to submit the form.',
		)
		const list = first(
			'module-list',
			'Add <module-list> component to display a list of todo items.',
		)
		const count = first(
			'basic-pluralize',
			'Add <basic-pluralize> component to display the number of todo items.',
		)
		const filter = first(
			'form-radiogroup',
			'Add <form-radiogroup> component to filter todo items.',
		)
		const clearCompleted = first(
			'basic-button.clear-completed',
			'Add <basic-button.clear-completed> component to clear completed todo items.',
		)
		const active = createElementsMemo(list, 'form-checkbox:not([checked])')
		const completed = createElementsMemo(list, 'form-checkbox[checked]')
		return {
			ui: { form, textbox, submit, list, count, filter, clearCompleted },
			effects: {
				form: on('submit', e => {
					e.preventDefault()
					const value = textbox.value.trim()
					if (!value) return
					list.add(item => {
						item.querySelector('slot')?.replaceWith(value)
					})
					textbox.clear()
				}),
				submit: pass({ disabled: () => !textbox.length }),
				list: setAttribute('filter', () => filter?.value || 'all'),
				count: pass({ count: () => active.get().length }),
				clearCompleted: [
					pass({
						disabled: () => !completed.get().length,
						badge: () =>
							completed.get().length ? String(completed.get().length) : '',
					}),
					on('click', () => {
						const items = completed.get()
						for (let i = items.length - 1; i >= 0; i--)
							items[i]!.closest('li')?.remove()
					}),
				],
			},
		}
	},
)
