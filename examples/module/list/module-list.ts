import { createList, defineComponent, type List } from '../../..'

declare global {
	interface HTMLElementTagNameMap {
		'module-list': HTMLElement
	}
}

/**
 * A dynamic list component demonstrating the `createList()` keyed reconciliation API.
 * Use it for add/remove item interfaces — items are added via a form submission
 * and removed via delegated click handling, with stable keys across reorders.
 * Each item must include a remove button with class `remove` for deletion to work;
 * the form should use a `<form-textbox>` for the new-item input.
 * @demo {./docs/examples/module-list.html} Interactive preview and usage examples */
export default defineComponent(
	'module-list',
	({ first, host, on, pass, watch }) => {
		const form = first('form', 'Add a form element to enter a new list item.')
		const textbox = first(
			'form-textbox',
			'Add <form-textbox> component to enter a new list item.',
		)
		const submit = first(
			'basic-button.submit',
			'Add <basic-button.submit> component to submit the form.',
		)
		const container = first(
			'[data-container]',
			'Add a container element for items.',
		)
		const template = first('template', 'Add a template element for items.')

		// Keyed reactive list of plain string items. The 'item' prefix feeds the
		// auto-incrementing key generator (item0, item1, ...); keys are stable
		// across reorders, which is what lets removal target the right item.
		const list: List<string> = createList<string>([], { keyConfig: 'item' })

		return [
			// Reconcile the container's children against the list's keys. Runs once
			// at connect and again whenever items are added or removed.
			watch(
				() => Array.from(list.keys()),
				keys => {
					const current = new Map<string, HTMLElement>()
					for (const child of container.children) {
						const el = child as HTMLElement
						if (el.dataset.key) current.set(el.dataset.key, el)
					}

					const keysSet = new Set(keys)

					// Drop children whose key is no longer in the list.
					for (const [key, el] of current) {
						if (!keysSet.has(key)) el.remove()
					}

					// Insert new keys (cloning the template) and move every child
					// into its target position. Existing nodes are reused, not recreated.
					for (let i = 0; i < keys.length; i++) {
						const key = keys[i]
						let el = key && current.get(key)
						if (key && !el) {
							const fragment = template.content.cloneNode(
								true,
							) as DocumentFragment
							el = fragment.firstElementChild as HTMLElement
							el.dataset.key = key
							el.querySelector('slot')?.replaceWith(
								document.createTextNode(list.byKey(key)?.get() ?? ''),
							)
						}
						const currentAtI = container.children[i]
						if (el && currentAtI !== el)
							container.insertBefore(el, currentAtI ?? null)
					}
				},
			),

			// Add on submit, then clear the input by calling the child's method.
			on(form, 'submit', e => {
				e.preventDefault()
				const value = textbox.value.trim()
				if (!value) return
				list.add(value)
				textbox.clear()
			}),

			// Event delegation: one handler removes any item whose Remove button
			// was clicked, scaling to any number of items.
			on(host, 'click', e => {
				const target = e.target as HTMLElement
				if (!target.closest('basic-button.remove')) return
				const item = target.closest('[data-key]')
				if (!(item instanceof HTMLElement)) return
				e.stopPropagation()
				const key = item.dataset.key
				if (key) list.remove(key)
			}),

			// Disable the submit button while the textbox is empty.
			pass(submit, { disabled: () => !textbox.length }),
		]
	},
)
