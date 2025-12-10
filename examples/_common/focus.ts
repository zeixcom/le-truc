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
		on('click', ({ event }) => {
			const target = event.target as HTMLElement
			if (target && target.hasAttribute('value'))
				index = collection.get().findIndex(item => item === target)
		}),
		on('keydown', ({ event }) => {
			const { key } = event
			if (!HANDLED_KEYS.includes(key)) return
			event.preventDefault()
			event.stopPropagation()
			if (key === FIRST_KEY) index = 0
			else if (key === LAST_KEY) index = collection.length - 1
			else
				index =
					(index + (INCREMENT_KEYS.includes(key) ? 1 : -1) + collection.length)
					% collection.length
			if (collection[index]) collection[index].focus()
		}),
		on('keyup', ({ event }) => {
			if (event.key === ENTER_KEY)
				if (collection[index]) collection[index].click()
		}),
	]
}
