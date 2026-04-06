import { type Component, defineComponent } from '../../..'

export type FormRadiogroupProps = {
	value: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-radiogroup': Component<FormRadiogroupProps>
	}
}

/* === Constants === */

const ENTER_KEY = 'Enter'
const DECREMENT_KEYS = ['ArrowLeft', 'ArrowUp']
const INCREMENT_KEYS = ['ArrowRight', 'ArrowDown']
const FIRST_KEY = 'Home'
const LAST_KEY = 'End'
const HANDLED_KEYS = [...DECREMENT_KEYS, ...INCREMENT_KEYS, FIRST_KEY, LAST_KEY]

const getIndex = (radios: HTMLInputElement[]) =>
	radios.findIndex(radio => radio.checked)

export default defineComponent<FormRadiogroupProps>(
	'form-radiogroup',
	({ all, each, expose, host, on, run }) => {
		const radios = all<HTMLInputElement>(
			'input[type="radio"]',
			'Add at least two native radio buttons.',
		)

		expose({
			value: () => {
				const arr = radios.get()
				return arr[getIndex(arr)]?.value ?? ''
			},
		})

		// Roving tabindex focus management (inlined from manageFocus)
		let focusIndex = getIndex(radios.get())

		return [
			on(radios, 'change', (e, el) => {
				host.value = (el as HTMLInputElement).value
			}),
			each(radios, radio =>
				run('value', value => {
					const isChecked = radio.value === value
					radio.checked = isChecked
					radio.tabIndex = isChecked ? 0 : -1
					const label = radio.closest('label')
					if (label) label.classList.toggle('selected', isChecked)
				}),
			),
			on(host, 'click', ({ target }) => {
				if (!(target instanceof HTMLElement)) return
				if (target.hasAttribute('value'))
					focusIndex = radios
						.get()
						.findIndex(item => item === target)
			}),
			on(host, 'keydown', e => {
				const { key } = e as KeyboardEvent
				if (!HANDLED_KEYS.includes(key)) return

				const elements = radios.get()
				e.preventDefault()
				e.stopPropagation()
				if (key === FIRST_KEY) focusIndex = 0
				else if (key === LAST_KEY) focusIndex = elements.length - 1
				else
					focusIndex =
						(focusIndex
							+ (INCREMENT_KEYS.includes(key) ? 1 : -1)
							+ elements.length)
						% elements.length
				elements[focusIndex]?.focus()
			}),
			on(host, 'keyup', ({ key }) => {
				if (key !== ENTER_KEY) return
				radios.get()[focusIndex]?.click()
			}),
		]
	},
)
