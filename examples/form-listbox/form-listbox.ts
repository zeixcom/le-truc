import {
	asString,
	type Component,
	createElementsMemo,
	createTask,
	dangerouslySetInnerHTML,
	defineComponent,
	type Memo,
	on,
	setAttribute,
	setProperty,
	setText,
	show,
	Task,
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

export type FormListboxOption = {
	value: string
	label: string
}

export type FormListboxGroups = Record<
	string,
	{
		label: string
		items: FormListboxOption[]
	}
>

export type FormListboxProps = {
	value: string
	options: HTMLButtonElement[]
	filter: string
	src: string
}

type FormListboxUI = {
	input: HTMLInputElement
	callout?: HTMLElement
	loading?: HTMLElement
	error?: HTMLElement
	listbox: HTMLElement
	options: Memo<HTMLButtonElement[]>
}

declare global {
	interface HTMLElementTagNameMap {
		'form-listbox': Component<FormListboxProps>
	}
}

export default defineComponent<FormListboxProps, FormListboxUI>(
	'form-listbox',
	{
		value: '',
		options: ({ listbox }: FormListboxUI) =>
			createElementsMemo(listbox, 'button[role="option"]:not([hidden])'),
		filter: '',
		src: asString(),
	},
	({ first, all }) => ({
		input: first('input[type="hidden"]', 'Needed to store the selected value.'),
		callout: first('card-callout'),
		loading: first('.loading'),
		error: first('.error'),
		listbox: first('[role="listbox"]', 'Needed to display list of options.'),
		options: all('button[role="option"]'),
	}),
	ui => {
		const { host, input } = ui

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

		const maybeRender = () =>
			host.src
				? [
						show(() => html.get().ok),
						dangerouslySetInnerHTML(() => html.get().value),
					]
				: []

		const html = createTask<{
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
			{ value: { ok: false, value: '', error: '', pending: true } },
		)
		const isSelected = (target: HTMLButtonElement) =>
			host.value === target.value
		const hasError = () => (host.src ? !!html.get().error : false)

		return {
			host: setAttribute('value'),
			input: setProperty('value'),
			callout: [
				show(() => (host.src ? !html.get().ok : false)),
				toggleClass('danger', hasError),
			],
			loading: show(() => (host.src ? html.get().pending : false)),
			error: [
				show(hasError),
				setText(() => (host.src ? html.get().error : '')),
			],
			listbox: [
				...manageFocus(
					() =>
						Array.from(
							ui.listbox.querySelectorAll<HTMLButtonElement>(
								'button[role="option"]:not([hidden])',
							),
						),
					options =>
						options.findIndex(option => option.ariaSelected === 'true'),
				),
				on('click', ({ target }) => {
					const option = (target as HTMLElement).closest(
						'[role="option"]',
					) as HTMLButtonElement
					if (option && option.value !== host.value) {
						host.value = option.value
						input.dispatchEvent(new Event('change', { bubbles: true }))
					}
				}),
				...maybeRender(),
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
