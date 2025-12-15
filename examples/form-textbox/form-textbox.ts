import {
	type Component,
	type ComponentUI,
	createSensor,
	defineComponent,
	on,
	read,
	setAttribute,
	setProperty,
	setText,
} from '../..'
import { clearEffects, clearMethod } from '../_common/clear'

export type FormTextboxProps = {
	value: string
	readonly length: number
	error: string
	description: string
	readonly clear: () => void
}

type FormTextboxUI = {
	textbox: HTMLInputElement | HTMLTextAreaElement
	clear?: HTMLButtonElement
	error?: HTMLElement
	description?: HTMLElement
}

declare global {
	interface HTMLElementTagNameMap {
		'form-textbox': Component<FormTextboxProps>
	}
}

export default defineComponent<FormTextboxProps, FormTextboxUI>(
	'form-textbox',
	{
		value: read(ui => ui.textbox.value, ''),
		length: createSensor(
			read(ui => ui.textbox.value.length, 0),
			'textbox',
			{
				input: ({ target }) => target.value.length,
			},
		),
		error: '',
		description: ({
			host,
			description,
			textbox,
		}: ComponentUI<FormTextboxProps, FormTextboxUI>) => {
			if (description) {
				if (textbox && textbox.maxLength && description.dataset.remaining) {
					return () =>
						description.dataset.remaining!.replace(
							'${n}',
							String(textbox.maxLength - host.length),
						)
				}
				return description.textContent?.trim() ?? ''
			} else {
				return ''
			}
		},
		clear: clearMethod,
	},
	({ first }) => ({
		textbox: first(
			'input, textarea',
			'Add a native input or textarea as descendant element.',
		),
		clear: first('button.clear'),
		error: first('.error'),
		description: first('.description'),
	}),
	ui => {
		const { host, textbox, error, description } = ui
		const errorId = error?.id
		const descriptionId = description?.id

		return {
			textbox: [
				on('change', () => {
					textbox.checkValidity()
					return {
						value: textbox.value,
						error: textbox.validationMessage,
					}
				}),
				setProperty('value'),
				setProperty('ariaInvalid', () => String(!!host.error)),
				setAttribute('aria-errormessage', () =>
					host.error && errorId ? errorId : null,
				),
				setAttribute('aria-describedby', () =>
					description && descriptionId ? descriptionId : null,
				),
			],
			clear: clearEffects(ui),
			error: setText('error'),
			description: setText('description'),
		}
	},
)
