import {
	batch,
	type Component,
	createEventsSensor,
	createMemo,
	createState,
	defineComponent,
	on,
	pass,
	read,
	setAttribute,
	setProperty,
	setText,
	show,
} from '../../..'
import { clearMethod } from '../../_common/clearMethod'
import type { FormListboxProps } from '../listbox/form-listbox'

export type FormComboboxProps = {
	value: string
	readonly length: number
	error: string
	description: string
	readonly clear: () => void
}

type FormComboboxUI = {
	textbox: HTMLInputElement
	listbox: Component<FormListboxProps>
	clear?: HTMLButtonElement | undefined
	error?: HTMLElement | undefined
	description?: HTMLElement | undefined
}

declare global {
	interface HTMLElementTagNameMap {
		'form-combobox': Component<FormComboboxProps>
	}
}

export default defineComponent<FormComboboxProps, FormComboboxUI>(
	'form-combobox',
	({ first, host }) => {
		const textbox = first('input', 'Needed to enter value.')
		const listbox = first('form-listbox', 'Needed to display options.')
		const clear = first('button.clear')
		const error = first('form-combobox > .error')
		const description = first('.description')

		const errorId = error?.id
		const descriptionId = description?.id

		const showPopup = createState(false)
		const isExpanded = createMemo(
			() => showPopup.get() && listbox.options.length > 0,
		)

		return {
			ui: { textbox, listbox, clear, error, description },
			props: {
				value: read(() => textbox.value, ''),
				length: createEventsSensor(textbox, textbox.value.length, {
					input: ({ target }) => target.value.length,
				}),
				error: '',
				description: read(() => description?.textContent, ''),
				clear: clearMethod,
			},
			effects: {
				host: [
					setAttribute('value'),
					on('keyup', ({ key }) => {
						if (key === 'Escape') {
							showPopup.set(false)
							textbox.focus()
						}
						if (key === 'Delete') host.clear()
					}),
				],
				textbox: [
					setProperty('ariaInvalid', () => String(!!host.error)),
					setAttribute('aria-errormessage', () =>
						host.error && errorId ? errorId : null,
					),
					setAttribute('aria-describedby', () =>
						host.description && descriptionId ? descriptionId : null,
					),
					setProperty('ariaExpanded', () => String(isExpanded.get())),
					on('input', () => {
						textbox.checkValidity()
						batch(() => {
							host.value = textbox.value
							host.error = textbox.validationMessage ?? ''
							showPopup.set(true)
						})
					}),
					on('keydown', e => {
						const { key, altKey } = e
						if (key === 'ArrowDown') {
							if (altKey) showPopup.set(true)
							if (isExpanded.get()) listbox.options[0]?.focus()
						}
					}),
				],
				listbox: [
					show(isExpanded),
					pass({
						filter: () => host.value,
					}),
					on('change', ({ target }) => {
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
				],
				clear: [
					show(() => !!host.length),
					on('click', () => {
						host.clear()
					}),
				],
				error: setText('error'),
				description: setText('description'),
			},
		}
	},
)
