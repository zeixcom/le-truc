import {
	asMethod,
	batch,
	type Component,
	createEventsSensor,
	createMemo,
	createState,
	defineComponent,
} from '../../..'
import type { FormListboxProps } from '../listbox/form-listbox'

export type FormComboboxProps = {
	value: string
	readonly length: number
	error: string
	description: string
	readonly clear: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-combobox': Component<FormComboboxProps>
	}
}

export default defineComponent<FormComboboxProps>(
	'form-combobox',
	({ expose, first, host, on, pass, run }) => {
		const textbox = first('input', 'Needed to enter value.') as HTMLInputElement
		const listbox = first<Component<FormListboxProps>>(
			'form-listbox',
			'Needed to display options.',
		)
		const clearBtn = first('button.clear')
		const errorEl = first('form-combobox > .error')
		const description = first('.description')

		const errorId = errorEl?.id
		const descriptionId = description?.id

		const showPopup = createState(false)
		const isExpanded = createMemo(
			() => showPopup.get() && listbox.options.length > 0,
		)

		expose({
			value: textbox.value,
			length: createEventsSensor(textbox, textbox.value.length, {
				input: ({ target }) => target.value.length,
			}),
			error: '',
			description: description?.textContent?.trim() ?? '',
			clear: asMethod(() => {
				;(host as any).clear = () => {
					host.value = ''
					textbox.value = ''
					textbox.setCustomValidity('')
					textbox.checkValidity()
					textbox.dispatchEvent(new Event('input', { bubbles: true }))
					textbox.dispatchEvent(new Event('change', { bubbles: true }))
					textbox.focus()
				}
			}),
		})

		// Set static aria attributes
		if (description && descriptionId) {
			textbox.setAttribute('aria-describedby', descriptionId)
		}

		return [
			run('value', value => {
				host.setAttribute('value', value)
			}),
			on(host, 'keyup', ({ key }: KeyboardEvent) => {
				if (key === 'Escape') {
					showPopup.set(false)
					textbox.focus()
				}
				if (key === 'Delete') host.clear()
			}),
			run('error', error => {
				textbox.ariaInvalid = String(!!error)
				if (error && errorId) {
					textbox.setAttribute('aria-errormessage', errorId)
				} else {
					textbox.removeAttribute('aria-errormessage')
				}
			}),
			run(isExpanded, expanded => {
				textbox.ariaExpanded = String(expanded)
			}),
			on(textbox, 'input', () => {
				textbox.checkValidity()
				batch(() => {
					host.value = textbox.value
					host.error = textbox.validationMessage ?? ''
					showPopup.set(true)
				})
			}),
			on(textbox, 'keydown', (e: KeyboardEvent) => {
				const { key, altKey } = e
				if (key === 'ArrowDown') {
					if (altKey) showPopup.set(true)
					if (isExpanded.get()) listbox.options[0]?.focus()
				}
			}),
			run(isExpanded, expanded => {
				listbox.hidden = !expanded
			}),
			pass(listbox, {
				filter: () => host.value,
			}),
			on(listbox, 'change', ({ target }: Event) => {
				if (target instanceof HTMLInputElement) {
					textbox.value = target.value
					textbox.checkValidity()
					batch(() => {
						host.value = target.value
						host.error = textbox.validationMessage ?? ''
						showPopup.set(false)
						textbox.focus()
					})
				}
			}),
			clearBtn
				&& run('length', length => {
					clearBtn.hidden = !length
				}),
			clearBtn
				&& on(clearBtn, 'click', () => {
					host.clear()
				}),
			errorEl
				&& run('error', text => {
					errorEl.textContent = text
				}),
			description
				&& run('description', text => {
					description.textContent = text
				}),
		]
	},
)
