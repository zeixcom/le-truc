import {
	asString,
	bindVisible,
	createElementsMemo,
	createMemo,
	createTask,
	defineComponent,
	each,
	escapeHTML,
	schedule,
} from '../../..'
import {
	fetchWithCache,
	isRecursiveURL,
	isValidURL,
} from '../../_common/fetchWithCache'
import { highlightMatch } from '../../_common/highlightMatch'
import { html } from '../../_common/html'

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

declare global {
	interface HTMLElementTagNameMap {
		'form-listbox': HTMLElement & FormListboxProps
	}
}

/* === Constants === */

const ENTER_KEY = 'Enter'
const DECREMENT_KEYS = ['ArrowUp']
const INCREMENT_KEYS = ['ArrowDown']
const FIRST_KEY = 'Home'
const LAST_KEY = 'End'
const HANDLED_KEYS = [...DECREMENT_KEYS, ...INCREMENT_KEYS, FIRST_KEY, LAST_KEY]

export default defineComponent<FormListboxProps>(
	'form-listbox',
	({ all, expose, first, host, on, watch }) => {
		const input = first(
			'input[type="hidden"]',
			'Needed to store the selected value.',
		) as HTMLInputElement
		const filterEl = first('input.filter') as HTMLInputElement | undefined
		const clearBtn = first('button.clear')
		const callout = first('card-callout')
		const loading = first('.loading')
		const errorEl = first('.error')
		const listbox = first(
			'[role="listbox"]',
			'Needed to display list of options.',
		)
		const options = all('button[role="option"]')

		const renderOptions = (items: FormListboxOption[]) =>
			items
				.map(
					item =>
						html`<button
							type="button"
							role="option"
							tabindex="-1"
							value="${escapeHTML(item.value)}"
						>
							${escapeHTML(item.label)}
						</button>`,
				)
				.join('')

		const renderGroups = (items: FormListboxGroups) => {
			const id = host.id
			let markup = ''
			for (const [key, value] of Object.entries(items)) {
				const groupId = `${id}-${escapeHTML(key)}`
				markup += html`<div role="group" aria-labelledby="${groupId}">
					<div role="presentation" id="${groupId}">
						${escapeHTML(value.label)}
					</div>
					${renderOptions(value.items)}
				</div>`
			}
			return markup
		}

		const content = createTask<string>(async (_prev, abort) => {
			const url = host.src
			if (!url) throw new Error('No URL provided')
			if (!isValidURL(url)) throw new Error('Invalid URL')
			if (isRecursiveURL(url, host)) throw new Error('Recursive URL detected')
			try {
				const { content: fetched } = await fetchWithCache(
					url,
					abort,
					response => response.json(),
				)
				return Array.isArray(fetched)
					? renderOptions(fetched)
					: renderGroups(fetched)
			} catch (e) {
				throw new Error(`Failed to fetch content for "${url}": ${String(e)}`)
			}
		})

		const lowerFilter = createMemo(() => host.filter.toLowerCase())

		// Roving tabindex focus management for listbox (inlined from manageFocus)
		const getVisibleOptions = () =>
			Array.from(
				listbox.querySelectorAll<HTMLButtonElement>(
					'button[role="option"]:not([hidden])',
				),
			)

		let focusIndex = getVisibleOptions().findIndex(
			option => option.ariaSelected === 'true',
		)

		expose({
			value: first('button[role="option"][aria-selected="true"]')?.value ?? '',
			options: createElementsMemo(
				listbox,
				'button[role="option"]:not([hidden])',
			),
			filter: '',
			src: asString(),
		})

		return [
			on(filterEl, 'input', (_e, el) => ({ filter: el.value ?? '' })),
			on(clearBtn, 'click', () => ({ filter: '' })),
			// Focus management on listbox
			on(listbox, 'click', ({ target }) => {
				const option = (target as HTMLElement).closest(
					'[role="option"]',
				) as HTMLButtonElement
				if (option && option.value !== host.value) {
					host.value = option.value
					input.dispatchEvent(new Event('change', { bubbles: true }))
				}
			}),
			on(listbox, 'keydown', e => {
				const { key } = e as KeyboardEvent
				if (!HANDLED_KEYS.includes(key)) return

				const elements = getVisibleOptions()
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
			}),
			on(listbox, 'keyup', ({ key }) => {
				if (key !== ENTER_KEY) return
				getVisibleOptions()[focusIndex]?.click()
			}),

			watch('value', value => {
				host.setAttribute('value', value)
				input.value = value
			}),
			host.src && [
				watch(content, {
					nil: () => {
						if (callout) callout.hidden = false
						if (loading) {
							loading.hidden = false
							return () => {
								loading.hidden = false
							}
						}
					},
					ok: html => {
						if (callout) callout.hidden = true
						if (loading) loading.hidden = true
						if (errorEl) errorEl.hidden = true
						listbox.hidden = false
						schedule(listbox, () => {
							listbox.innerHTML = html
						})
						return () => {
							listbox.hidden = true
						}
					},
					err: error => {
						if (callout) {
							callout.hidden = false
							callout.classList.add('danger')
						}
						if (errorEl) {
							errorEl.hidden = false
							errorEl.textContent = error.message
						}
						return () => {
							if (callout) callout.classList.remove('danger')
							if (errorEl) {
								errorEl.hidden = true
								errorEl.textContent = ''
							}
						}
					},
				}),
			],

			// Per-option reactive effects
			each(options, option => {
				const textContent = option.textContent
				const lowerText = textContent?.trim().toLowerCase()
				return [
					watch(lowerFilter, filterText => {
						option.hidden = !lowerText?.includes(filterText)
						option.innerHTML = highlightMatch(textContent, filterText)
					}),
					watch('value', () => {
						const isSelected = host.value === option.value
						option.tabIndex = isSelected ? 0 : -1
						option.ariaSelected = String(isSelected)
					}),
				]
			}),

			clearBtn && watch(lowerFilter, bindVisible(clearBtn)),
		]
	},
)
