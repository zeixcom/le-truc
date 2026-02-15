import {
	type Component,
	defineComponent,
	getWatchedElements,
	on,
	pass,
	setAttribute,
} from '../..'
import { BasicButtonProps } from '../basic-button/basic-button'
import { BasicPluralizeProps } from '../basic-pluralize/basic-pluralize'
import { FormRadiogroupProps } from '../form-radiogroup/form-radiogroup'
import { FormTextboxProps } from '../form-textbox/form-textbox'
import { ModuleListProps } from '../module-list/module-list'

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
		const active = getWatchedElements(list, 'form-checkbox:not([checked])')
		const completed = getWatchedElements(list, 'form-checkbox[checked]')

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
			count: pass({ count: () => active.length }),
			clearCompleted: [
				pass({
					disabled: () => !completed().length,
					badge: () => (completed().length ? String(completed().length) : ''),
				}),
				on('click', () => {
					const items = completed()
					for (let i = items.length - 1; i >= 0; i--)
						items[i].closest('li')?.remove()
				}),
			],
		}
	},
)
