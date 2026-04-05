import {
	type Component,
	createEventsSensor,
	defineComponent,
	on,
	read,
	setAttribute,
	setProperty,
	setText,
	show,
} from '../../..'
import { clearMethod } from '../../_common/clearMethod'

export type FormTextboxProps = {
	value: string
	readonly length: number
	error: string
	description: string
	readonly clear: () => void
}

type FormTextboxUI = {
	textbox: HTMLInputElement | HTMLTextAreaElement
	clear?: HTMLButtonElement | undefined
	error?: HTMLElement | undefined
	description?: HTMLElement | undefined
}

declare global {
	interface HTMLElementTagNameMap {
		'form-textbox': Component<FormTextboxProps>
	}
}

export default defineComponent<FormTextboxProps, FormTextboxUI>(
	'form-textbox',
	({ first, host }) => {
		const textbox = first(
			'input, textarea',
			'Add a native input or textarea as descendant element.',
		)
		const clear = first('button.clear')
		const error = first('.error')
		const description = first('.description')

		const errorId = error?.id
		const descriptionId = description?.id

		return {
			ui: { textbox, clear, error, description },
			props: {
				value: read(() => textbox.value, ''),
				length: createEventsSensor(textbox, textbox.value.length, {
					input: ({ target }) => target.value.length,
				}),
				error: '',
				description: () => {
					if (description) {
						if (textbox.maxLength > 0 && description.dataset.remaining) {
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
			effects: {
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
