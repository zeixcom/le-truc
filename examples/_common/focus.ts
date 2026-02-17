import { on } from '../..'

/* === Constants ===  */

const ENTER_KEY = 'Enter'
const DECREMENT_KEYS = ['ArrowLeft', 'ArrowUp']
const INCREMENT_KEYS = ['ArrowRight', 'ArrowDown']
const FIRST_KEY = 'Home'
const LAST_KEY = 'End'
const HANDLED_KEYS = [...DECREMENT_KEYS, ...INCREMENT_KEYS, FIRST_KEY, LAST_KEY]

/* === Exported Functions === */

export const manageFocus = <E extends HTMLInputElement | HTMLButtonElement>(
	getElements: () => E[],
	getSelectedIndex: (radios: E[]) => number,
) => {
	let index = getSelectedIndex(getElements())

	return [
		on('click', ({ target }) => {
			if (!(target instanceof HTMLElement)) return
			if (target && target.hasAttribute('value'))
				index = getElements().findIndex(item => item === target)
		}),
		on('keydown', e => {
			const { key } = e
			if (!HANDLED_KEYS.includes(key)) return

			const elements = getElements()
			e.preventDefault()
			e.stopPropagation()
			if (key === FIRST_KEY) index = 0
			else if (key === LAST_KEY) index = elements.length - 1
			else
				index =
					(index + (INCREMENT_KEYS.includes(key) ? 1 : -1) + elements.length) %
					elements.length
			if (elements[index]) elements[index].focus()
		}),
		on('keyup', ({ key }) => {
			if (key !== ENTER_KEY) return

			const element = getElements()[index]
			if (element) element.click()
		}),
	]
}
