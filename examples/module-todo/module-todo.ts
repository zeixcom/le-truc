import {
	type Component,
	createElementsMemo,
	defineComponent,
	on,
	pass,
	setAttribute,
} from '../..'
import type { BasicButtonProps } from '../basic-button/basic-button'
import type { BasicPluralizeProps } from '../basic-pluralize/basic-pluralize'
import type { FormRadiogroupProps } from '../form-radiogroup/form-radiogroup'
import type { FormTextboxProps } from '../form-textbox/form-textbox'
import type { ModuleListProps } from '../module-list/module-list'

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
	{},
	({ first }) => ({
		form: first('form', 'Add a form element to enter a new todo item.'),
		textbox: first(
			'form-textbox',
			'Add <form-textbox> component to enter a new todo item.',
		),
		submit: first(
			'basic-button.submit',
			'Add <basic-button.submit> component to submit the form.',
		),
		list: first(
			'module-list',
			'Add <module-list> component to display a list of todo items.',
		),
		count: first(
			'basic-pluralize',
			'Add <basic-pluralize> component to display the number of todo items.',
		),
		filter: first(
			'form-radiogroup',
			'Add <form-radiogroup> component to filter todo items.',
		),
		clearCompleted: first(
			'basic-button.clear-completed',
			'Add <basic-button.clear-completed> component to clear completed todo items.',
		),
	}),
	({ textbox, list, filter }) => {
		const active = createElementsMemo(list, 'form-checkbox:not([checked])')
		const completed = createElementsMemo(list, 'form-checkbox[checked]')

		return {
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
						items[i].closest('li')?.remove()
				}),
			],
		}
	},
)
