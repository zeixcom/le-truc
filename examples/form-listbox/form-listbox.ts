import {
	asString,
	type Collection,
	type Component,
	createCollection,
	createComputed,
	dangerouslySetInnerHTML,
	defineComponent,
	emit,
	on,
	setAttribute,
	setProperty,
	setText,
	show,
	toggleClass,
} from '../..'

import { fetchWithCache, isRecursiveURL, isValidURL } from '../_common/fetch'
import { manageFocus } from '../_common/focus'
import { highlightMatch } from '../_common/highlight'

/**
 * Form-aware Listbox Component
 *
 * A filterable listbox that loads options from remote JSON sources and integrates
 * seamlessly with HTML forms. Includes keyboard navigation, accessibility features,
 * and automatic form value synchronization via a built-in hidden input element.
 */

type FormListboxOption = {
	value: string
	label: string
}

type FormListboxGroups = Record<
	string,
	{
		label: string
		items: FormListboxOption[]
	}
>

type FormListboxProps = {
	value: string
	filter: string
	src: string
}

type FormListboxUI = {
	input?: HTMLInputElement
	callout?: HTMLElement
	loading?: HTMLElement
	error?: HTMLElement
	listbox: HTMLElement
	options: Collection<HTMLButtonElement>
}

declare global {
	interface HTMLElementTagNameMap {
		'form-listbox': Component<FormListboxProps>
	}
	interface HTMLElementEventMap {
		'form-listbox.change': CustomEvent<string>
	}
}

export default defineComponent<FormListboxProps, FormListboxUI>(
	'form-listbox',
	{
		value: '',
		filter: '',
		src: asString(),
	},
	({ first, all }) => ({
		input: first('input[type="hidden"]'),
		callout: first('card-callout'),
		loading: first('.loading'),
		error: first('.error'),
		listbox: first('[role="listbox"]', 'Needed to display list of options.'),
		options: all('button[role="option"]'),
	}),
	ui => {
		const { host } = ui

		const visibleOptions = createCollection<
			'button[role="option"]:not([hidden])',
			HTMLButtonElement
		>(host, 'button[role="option"]:not([hidden])')

		const renderOptions = (items: FormListboxOption[]) =>
			items
				.map(
					item => `
					<button type="button" role="option" tabindex="-1" value="${item.value}">
						${item.label}
					</button>`,
				)
				.join('')

		const renderGroups = (items: FormListboxGroups) => {
			const id = host.id
			let html = ''
			for (const [key, value] of Object.entries(items)) {
				html += `
				<div role="group" aria-labelledby="${id}-${key}">
					<div role="presentation" id="${id}-${key}">${value.label}</div>
					${renderOptions(value.items)}
				</div>`
			}
			return html
		}

		const html = createComputed<{
			ok: boolean
			value: string
			error: string
			pending: boolean
		}>(
			async (_prev, abort) => {
				const url = host.src
				const error = !url
					? 'No URL provided'
					: !isValidURL(url)
						? 'Invalid URL'
						: isRecursiveURL(url, host)
							? 'Recursive URL detected'
							: ''
				if (error) return { ok: false, value: '', error, pending: false }

				try {
					const { content } = await fetchWithCache(url, abort, response =>
						response.json(),
					)
					return {
						ok: true,
						value: Array.isArray(content)
							? renderOptions(content)
							: renderGroups(content),
						error: '',
						pending: false,
					}
				} catch (err) {
					return { ok: false, value: '', error: String(err), pending: false }
				}
			},
			{ ok: false, value: '', error: '', pending: true },
		)
		const isSelected = (target: HTMLButtonElement) =>
			host.value === target.value
		const hasError = () => !!html.get().error

		return {
			host: [setAttribute('value'), emit('form-listbox.change', 'value')],
			input: [setProperty('value')],
			callout: [show(() => !html.get().ok), toggleClass('danger', hasError)],
			loading: [show(() => html.get().pending)],
			error: [show(hasError), setText(() => html.get().error)],
			listbox: [
				...manageFocus(visibleOptions, options =>
					options.get().findIndex(option => option.ariaSelected === 'true'),
				),
				on('click', ({ event }) => {
					const option = (event.target as HTMLElement).closest(
						'[role="option"]',
					) as HTMLButtonElement
					if (option) return { value: option.value }
				}),
				show(() => html.get().ok),
				dangerouslySetInnerHTML(() => html.get().value),
			],
			options: [
				setProperty('tabIndex', target => (isSelected(target) ? 0 : -1)),
				show(target =>
					target.textContent
						?.trim()
						.toLowerCase()
						.includes(host.filter.toLowerCase()),
				),
				dangerouslySetInnerHTML(target =>
					highlightMatch(target.textContent ?? '', host.filter),
				),
				setProperty('ariaSelected', target => String(isSelected(target))),
			],
		}
	},
)
