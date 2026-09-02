import { createList, defineComponent, reconcile } from '@zeix/le-truc'

/**
 * Teaching component for the "Reconcile the DOM" section of the Dynamic
 * Lists docs page.
 *
 * A keyed list of Swiss towns drives `reconcile()`. Each row keeps its own
 * checkbox. Check a box, then shuffle or reverse — the checkbox state
 * survives, because rows are moved, never recreated. The `created #n`
 * label on each row proves it: the number stays with the element that was
 * stamped when its key first entered, no matter how often the order
 * changes. New keys always get the next number.
 */

const TOWNS = ['Adelboden', 'Basel', 'Chur', 'Davos']
const MORE_TOWNS = [
	'Engelberg',
	'Filisur',
	'Geneva',
	'Herisau',
	'Interlaken',
	'Juf',
	'Kreuzlingen',
	'Lugano',
	'Montreux',
	'Neuchâtel',
	'Olten',
]

const shuffle = <T>(items: T[]): T[] => {
	const result = [...items]
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const a = result[i] as T
		const b = result[j] as T
		result[i] = b
		result[j] = a
	}
	return result
}

export default defineComponent('docs-reconcile', ({ first, host, on }) => {
	const container = first('[data-container]', 'Add a container for docs-reconcile rows.')
	const template = first('template', 'Add a template for docs-reconcile rows.')

	let created = 0
	const list = createList(TOWNS, { keyConfig: (town: string) => town })

	reconcile(container, template, list, (_row, _item, key, first) => {
		const keyEl = first('.label')
		const stampEl = first('small')
		if (keyEl) keyEl.textContent = key ?? ''
		if (stampEl) stampEl.textContent = `created #${++created}`
	})

	on(host, 'click', e => {
		const target = e.target as HTMLElement
		if (target.matches('[data-add]')) {
			const next = MORE_TOWNS.find(town => !list.get().includes(town))
			if (next) list.add(next)
		} else if (target.matches('[data-remove]')) {
			const items = list.get()
			if (items.length > 0) list.remove(items[items.length - 1] ?? '')
		} else if (target.matches('[data-shuffle]')) {
			list.update(prev => shuffle(prev))
		} else if (target.matches('[data-reverse]')) {
			list.update(prev => [...prev].reverse())
		}
	})
})
