import {
	asMethod,
	type Component,
	createEventsSensor,
	createMemo,
	defineComponent,
} from '../../..'

export type FormTextboxProps = {
	value: string
	readonly length: number
	error: string
	description: string
	clear: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-textbox': Component<FormTextboxProps>
	}
}

export default defineComponent<FormTextboxProps>(
	'form-textbox',
	({ expose, first, host, on, run }) => {
		const textbox = first(
			'input, textarea',
			'Add a native input or textarea as descendant element.',
		) as HTMLInputElement | HTMLTextAreaElement
		const clearBtn = first('button.clear')
		const errorEl = first('.error')
		const description = first('.description')

		const errorId = errorEl?.id
		const descriptionId = description?.id

		// Reactive description: tracks remaining character count if template is present
		const descriptionMemo =
			description && textbox.maxLength > 0 && description.dataset.remaining
				? createMemo(() =>
						description.dataset.remaining!.replace(
							'${n}',
							String(textbox.maxLength - host.length),
						),
					)
				: null

		expose({
			value: textbox.value,
			length: createEventsSensor(textbox, textbox.value.length, {
				input: ({ target }) => target.value.length,
			}),
			error: '',
			description: descriptionMemo ?? description?.textContent?.trim() ?? '',
			clear: asMethod(() => {
				host.clear = () => {
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

		// Set aria-describedby once (static relationship)
		if (description && descriptionId)
			textbox.setAttribute('aria-describedby', descriptionId)

		return [
			on(textbox, 'change', () => {
				textbox.checkValidity()
				return {
					value: textbox.value,
					error: textbox.validationMessage,
				}
			}),
			run('value', value => {
				textbox.value = value
			}),
			run('error', error => {
				textbox.ariaInvalid = String(!!error)
				if (error && errorId) {
					textbox.setAttribute('aria-errormessage', errorId)
				} else {
					textbox.removeAttribute('aria-errormessage')
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
