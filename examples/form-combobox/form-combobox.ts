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
} from '../..'
import { clearEffects, clearMethod } from '../_common/clear'
import { FormListboxProps } from '../form-listbox/form-listbox'

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
	clear?: HTMLButtonElement
	error?: HTMLElement
	description?: HTMLElement
}

declare global {
	interface HTMLElementTagNameMap {
		'form-combobox': Component<FormComboboxProps>
	}
}

export default defineComponent<FormComboboxProps, FormComboboxUI>(
	'form-combobox',
	{
		value: read(ui => ui.textbox.value, ''),
		length: createEventsSensor(
			read(ui => ui.textbox.value.length, 0),
			'textbox',
			{
				input: ({ target }) => target.value.length,
			},
		),
		error: '',
		description: read(ui => ui.description?.textContent, ''),
		clear: clearMethod,
	},
	({ first }) => ({
		textbox: first('input', 'Needed to enter value.'),
		listbox: first('form-listbox', 'Needed to display options.'),
		clear: first('button.clear'),
		error: first('form-combobox > .error'),
		description: first('.description'),
	}),
	ui => {
		const { host, error, description, listbox, textbox } = ui
		const errorId = error?.id
		const descriptionId = description?.id

		const showPopup = createState(false)
		const isExpanded = createMemo(
			() => showPopup.get() && listbox.options.length > 0,
		)

		return {
			host: [
				setAttribute('value'),
				on('keyup', ({ key }) => {
					if (key === 'Escape') showPopup.set(false)
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
						})
					}
				}),
			],
			clear: [...clearEffects(ui)],
			error: [setText('error')],
			description: [setText('description')],
		}
	},
)
