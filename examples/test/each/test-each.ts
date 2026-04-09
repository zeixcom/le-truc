import { defineComponent, each } from '../../..'

export type TestEachProps = {
	selected: number
}

declare global {
	interface HTMLElementTagNameMap {
		'test-each': HTMLElement & TestEachProps
	}
}

/**
 * Test component for the v2.0 factory `each()` helper.
 * Exercises: nested run inside each, nested on inside each,
 * per-element lifecycle (add/remove), single-descriptor shortcut.
 */
export default defineComponent<TestEachProps>(
	'test-each',
	({ expose, first, all, on, watch }) => {
		first('ul', 'Add a <ul> element.')
		const items = all('li')

		expose({ selected: -1 })

		return [
			// each() with FactoryResult array (run + on per element)
			each(items, item => {
				const index = Number(item.dataset.index ?? -1)
				return [
					// nested run: highlight selected item
					watch('selected', sel => {
						item.classList.toggle('active', sel === index)
					}),
					// nested on: clicking item updates selected prop
					on(item, 'click', () => ({ selected: index })),
				]
			}),
		]
	},
)
