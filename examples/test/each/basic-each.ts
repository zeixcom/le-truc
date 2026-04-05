import { type Component, createElementsMemo, defineComponent } from '../../..'

export type BasicEachProps = {
	selected: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-each': Component<BasicEachProps>
	}
}

/**
 * Test component for the v1.1 factory `each()` helper.
 * Exercises: nested run inside each, nested on inside each,
 * per-element lifecycle (add/remove), single-descriptor shortcut.
 */
export default defineComponent<BasicEachProps>(
	'basic-each',
	({ expose, first, all, each, on, run }) => {
		const list = first('ul', 'Add a <ul> element.')
		const items = all('li')

		expose({ selected: -1 })

		return [
			// each() with FactoryResult array (run + on per element)
			each(items, item => {
				const index = Number(item.dataset.index ?? -1)
				return [
					// nested run: highlight selected item
					run('selected', sel => {
						item.classList.toggle('active', sel === index)
					}),
					// nested on: clicking item updates selected prop
					on(item, 'click', () => ({ selected: index })),
				]
			}),
		]
	},
)
