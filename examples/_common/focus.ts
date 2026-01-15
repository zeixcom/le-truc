import { type Collection, on } from '../..'

/* === Constants ===  */

const ENTER_KEY = 'Enter'
const DECREMENT_KEYS = ['ArrowLeft', 'ArrowUp']
const INCREMENT_KEYS = ['ArrowRight', 'ArrowDown']
const FIRST_KEY = 'Home'
const LAST_KEY = 'End'
const HANDLED_KEYS = [...DECREMENT_KEYS, ...INCREMENT_KEYS, FIRST_KEY, LAST_KEY]

/* === Exported Functions === */

export const manageFocus = <E extends HTMLInputElement | HTMLButtonElement>(
	collection: Collection<E>,
	getSelectedIndex: (radios: Collection<E>) => number,
) => {
	let index = getSelectedIndex(collection)

	return [
		on('click', ({ target }) => {
			if (!(target instanceof HTMLElement)) return
			if (target.hasAttribute('value'))
				index = collection.get().indexOf(target as E)
		}),
		on('keydown', e => {
			const { key } = e
			if (!HANDLED_KEYS.includes(key)) return
			e.preventDefault()
			e.stopPropagation()
			if (key === FIRST_KEY) index = 0
			else if (key === LAST_KEY) index = collection.length - 1
			else
				index =
					(index + (INCREMENT_KEYS.includes(key) ? 1 : -1) + collection.length)
					% collection.length
			collection.at(index)?.get().focus()
		}),
		on('keyup', ({ key }) => {
			if (key === ENTER_KEY) collection.at(index)?.get().click()
		}),
	]
}
