import { type EffectDescriptor } from '../..'

/* === Constants ===  */

const ENTER_KEY = 'Enter'
const DECREMENT_KEYS = ['ArrowLeft', 'ArrowUp']
const INCREMENT_KEYS = ['ArrowRight', 'ArrowDown']
const FIRST_KEY = 'Home'
const LAST_KEY = 'End'
const HANDLED_KEYS = [...DECREMENT_KEYS, ...INCREMENT_KEYS, FIRST_KEY, LAST_KEY]

/* === Exported Functions === */

export const manageFocus = <E extends HTMLInputElement | HTMLButtonElement>(
	container: Element,
	getElements: () => E[],
	getSelectedIndex: (radios: E[]) => number,
): EffectDescriptor[] => {
	let index = getSelectedIndex(getElements())

	const onClick = (e: Event) => {
		const target = e.target as HTMLElement
		if (target && target.hasAttribute('value'))
			index = getElements().indexOf(target as E)
	}

	const onKeydown = (e: Event) => {
		const { key } = e as KeyboardEvent
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
		const focused = elements[index]
		if (focused) focused.focus()
	}

	const onKeyup = (e: Event) => {
		const { key } = e as KeyboardEvent
		if (key !== ENTER_KEY) return

		const element = getElements()[index]
		if (element) element.click()
	}

	return [
		() => {
			container.addEventListener('click', onClick)
			container.addEventListener('keydown', onKeydown)
			container.addEventListener('keyup', onKeyup)
			return () => {
				container.removeEventListener('click', onClick)
				container.removeEventListener('keydown', onKeydown)
				container.removeEventListener('keyup', onKeyup)
			}
		},
	]
}
