import {
	bindProperty,
	defineComponent,
	each,
	type FormAssociatedElement,
	formAssociated,
} from '@zeix/le-truc'

export type FormRadiogroupProps = {
	/** Value of the currently selected radio button. */
	value: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-radiogroup': FormAssociatedElement & FormRadiogroupProps
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

/**
 * A radio group with roving tabindex keyboard navigation and reactive value tracking.
 * Use it for single-choice selection — provides ARIA radiogroup semantics, Arrow/Home/End
 * key support, and focus management across the radio options. Form participation and
 * validity are via ElementInternals (`formAssociated()`) — set `name` on the host, not
 * the individual radios, which are presentational only.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-radiogroup} Interactive preview and usage examples
 **/
export default defineComponent<FormRadiogroupProps>(
	'form-radiogroup',
	({ all, expose, host, on, watch }) => {
		const radios = all(
			'input[type="radio"]',
			'Add at least two native radio buttons.',
		)

		// Roving tabindex focus management
		let focusIndex = getIndex(radios.get())

		expose({ value: radios.get()[focusIndex]?.value ?? '' })

		on(radios, 'change', (_e, el) => ({ value: el.value }))
		on(host, 'click', ({ target }) => {
			if (!(target instanceof HTMLElement)) return
			if (target.hasAttribute('value'))
				focusIndex = radios.get().indexOf(target as HTMLInputElement)
		})
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
					(focusIndex +
						(INCREMENT_KEYS.includes(key) ? 1 : -1) +
						elements.length) %
					elements.length
			elements[focusIndex]?.focus()
		})
		on(host, 'keyup', ({ key }) => {
			if (key !== ENTER_KEY) return
			radios.get()[focusIndex]?.click()
		})

		each(radios, radio => {
			watch(
				() => radio.value === host.value,
				isChecked => {
					radio.checked = isChecked
					radio.tabIndex = isChecked ? 0 : -1
					radio.closest('label')?.classList.toggle('selected', isChecked)
				},
			)
			watch('disabled', bindProperty(radio, 'disabled'))
		})
	},
	[formAssociated()],
)
