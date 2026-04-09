import {
	asString,
	bindVisible,
	createEffect,
	createElementsMemo,
	createMemo,
	createTask,
	dangerouslyBindInnerHTML,
	defineComponent,
	each,
	escapeHTML,
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

		const content = createTask<{
			ok: boolean
			value: string
			error: string
			pending: boolean
		}>(
			async (_prev, abort) => {
				const url = host.src
				const err = !url
					? 'No URL provided'
					: !isValidURL(url)
						? 'Invalid URL'
						: isRecursiveURL(url, host)
							? 'Recursive URL detected'
							: ''
				if (err) return { ok: false, value: '', error: err, pending: false }

				try {
					const { content: fetched } = await fetchWithCache(
						url,
						abort,
						response => response.json(),
					)
					return {
						ok: true,
						value: Array.isArray(fetched)
							? renderOptions(fetched)
							: renderGroups(fetched),
						error: '',
						pending: false,
					}
				} catch (err) {
					return { ok: false, value: '', error: String(err), pending: false }
				}
			},
			{ value: { ok: false, value: '', error: '', pending: true } },
		)

		const lowerFilter = createMemo(() => host.filter.toLowerCase())
		const hasError = () => (host.src ? !!content.get().error : false)

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
			watch('value', value => {
				host.setAttribute('value', value)
				input.value = value
			}),
			filterEl
				&& on(filterEl, 'input', () => {
					host.filter = filterEl.value ?? ''
				}),
			clearBtn && watch(lowerFilter, bindVisible(clearBtn)),
			clearBtn
				&& on(clearBtn, 'click', () => {
					host.filter = ''
				}),
			callout
				&& (() =>
					createEffect(() => {
						callout.hidden = host.src ? content.get().ok : true
						callout.classList.toggle('danger', hasError())
					})),
			loading
				&& (() =>
					createEffect(() => {
						loading.hidden = !(host.src ? content.get().pending : false)
					})),
			errorEl
				&& (() =>
					createEffect(() => {
						errorEl.hidden = !hasError()
						errorEl.textContent = host.src ? content.get().error : ''
					})),
			// Render remote content into listbox
			host.src
				? () =>
						createEffect(() => {
							listbox.hidden = !content.get().ok
						})
				: undefined,
			host.src
				? watch(
						createMemo(() => content.get().value),
						dangerouslyBindInnerHTML(listbox),
					)
				: undefined,
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
						(focusIndex
							+ (INCREMENT_KEYS.includes(key) ? 1 : -1)
							+ elements.length)
						% elements.length
				elements[focusIndex]?.focus()
			}),
			on(listbox, 'keyup', ({ key }) => {
				if (key !== ENTER_KEY) return
				getVisibleOptions()[focusIndex]?.click()
			}),
			// Per-option reactive effects
			each(options, option => [
				() => {
					const textContent = option.textContent
					const lowerText = textContent?.trim().toLowerCase()
					return createEffect(() => {
						const filterText = lowerFilter.get()
						option.hidden = !lowerText?.includes(filterText)
						option.innerHTML = highlightMatch(textContent, filterText)
					})
				},
				watch('value', () => {
					const isSelected = host.value === option.value
					option.tabIndex = isSelected ? 0 : -1
					option.ariaSelected = String(isSelected)
				}),
			]),
		]
	},
)
