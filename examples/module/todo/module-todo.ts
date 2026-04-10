import { createElementsMemo, defineComponent } from '../../..'

declare global {
	interface HTMLElementTagNameMap {
		'module-todo': HTMLElement
	}
}

export default defineComponent('module-todo', ({ first, on, pass, watch }) => {
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

	return [
		on(form, 'submit', e => {
			e.preventDefault()
			const value = textbox.value.trim()
			if (!value) return
			list.add(item => {
				item.querySelector('slot')?.replaceWith(value)
			})
			textbox.clear()
		}),
		pass(submit, { disabled: () => !textbox.length }),
		watch(
			() => filter.value,
			value => {
				list.setAttribute('filter', value || 'all')
			},
		),
		pass(count, { count: () => active.get().length }),
		pass(clearCompleted, {
			disabled: () => !completed.get().length,
			badge: () =>
				completed.get().length ? String(completed.get().length) : '',
		}),
		on(clearCompleted, 'click', () => {
			const items = completed.get()
			for (let i = items.length - 1; i >= 0; i--)
				items[i]!.closest('li')?.remove()
		}),
	]
})
