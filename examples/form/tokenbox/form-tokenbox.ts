import {
	bindText,
	createList,
	DuplicateKeyError,
	defineComponent,
	defineMethod,
	type FormAssociatedElement,
	formAssociated,
	type MutableList,
	reconcile,
} from '../../../index'

export type FormTokenboxProps = {
	/** Committed tokens, joined by `", "`. Setting it re-splits on `,` and rebuilds the pills. */
	value: string
	/** Helper text shown below the input. */
	description: string
	/** Removes all tokens and clears the input, then dispatches `input` and `change` events. */
	clear: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-tokenbox': FormAssociatedElement & FormTokenboxProps
	}
}

const splitTokens = (raw: string): string[] => {
	const seen = new Set<string>()
	const parts = raw
		.split(',')
		.map(part => part.trim())
		.filter(part => {
			if (!part) return false
			const key = part.toLowerCase()
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
	return parts
}

/**
 * A tokenized text input: typed text becomes a removable pill on `,` or on blur,
 * gated by the native input's own constraint validation (`pattern`, `maxlength`, …
 * left on the descendant `<input>` still apply to each candidate token). Form
 * participation and validity are via ElementInternals (`formAssociated()`); the
 * exposed `value` is the committed tokens joined by `", "`.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-tokenbox} Interactive preview and usage examples
 **/
export default defineComponent<FormTokenboxProps>(
	'form-tokenbox',
	({ expose, first, host, on, watch }) => {
		const textbox = first(
			'input',
			'Add a native <input> descendant for typing new tokens.',
		)
		const container = first(
			'[data-container]',
			'Add a container element with [data-container] to hold token pills and the input.',
		)
		const template = first(
			'template',
			'Add a template element for token pills.',
		)

		// Server-rendered input value seeds the initial tokens (progressive
		// enhancement); the input itself only ever holds in-progress draft text.
		const tokens: MutableList<string> = createList<string>(
			splitTokens(textbox.value),
			{
				keyConfig: v => v.toLowerCase(),
			},
		)

		const statusEl = first('.status')
		const announce = (message: string) => {
			if (statusEl) statusEl.textContent = message
		}

		// Attempts to turn the input's current draft text into a token pill.
		// Gated by the native input's own constraint validation, so `pattern` /
		// `maxlength` / etc. left on the descendant <input> still apply — an
		// invalid candidate stays in the input and surfaces via validationMessage
		// instead of becoming a pill. A duplicate is surfaced the same way (custom
		// validity, text left in the input for correction) rather than silently
		// dropped, since it's the same "this candidate can't become a pill" case.
		const commit = (raw: string): boolean => {
			const trimmed = raw.trim()
			if (!trimmed) return false
			textbox.value = trimmed
			if (!textbox.checkValidity()) {
				host.setCustomValidity(textbox.validationMessage)
				return false
			}
			try {
				tokens.add(trimmed)
				host.setCustomValidity('')
			} catch (e) {
				if (e instanceof DuplicateKeyError) {
					host.setCustomValidity(`${trimmed} is already in the list`)
					return false
				}
				throw e
			}
			textbox.value = ''
			announce(`Added token: ${trimmed}`)
			return true
		}

		const removeToken = (key: string) => {
			const value = tokens.byKey(key)?.get()
			tokens.remove(key)
			if (value) announce(`Removed token: ${value}`)
		}

		expose({
			// `tokens` is the single source of truth; `value` is a mediated view
			// onto it. The setter re-splits and rebuilds the pills when `value` is
			// set from outside (consumer code, form reset, form state restore).
			// `tokens.set()` already no-ops on a content-equal array (MutableList
			// diffs by key before propagating), so no manual equality guard here.
			value: {
				get: () => tokens.get().join(', '),
				set: (v: string) => tokens.set(splitTokens(v)),
			},
			description: first('.description')?.textContent?.trim() ?? '',
			clear: defineMethod(() => {
				tokens.set([])
				host.setCustomValidity('')
				textbox.value = ''
				textbox.setCustomValidity('')
				textbox.checkValidity()
				textbox.dispatchEvent(new Event('input', { bubbles: true }))
				textbox.dispatchEvent(new Event('change', { bubbles: true }))
				textbox.focus()
			}),
		})

		on(textbox, 'keydown', event => {
			const { key } = event
			if (key === ',' || key === 'Enter') {
				// Enter would otherwise submit an enclosing <form>; committing the
				// draft text as a token is the more useful default here.
				event.preventDefault()
				commit(textbox.value)
			} else if (key === 'Backspace' && textbox.value === '') {
				const lastKey = tokens.keyAt(tokens.length - 1)
				if (lastKey) removeToken(lastKey)
			}
		})
		on(textbox, 'blur', () => {
			commit(textbox.value)
		})

		reconcile(container, template, tokens, (_element, item, _key, first) => {
			const value = item.get()
			first('slot')?.replaceWith(document.createTextNode(value))
			const removeBtn = first(
				'button.remove',
				'Add a remove <button> to the token template.',
			)
			removeBtn.setAttribute('aria-label', `Remove ${value}`)
		})

		// Event delegation: one handler removes any token whose remove button
		// was clicked, scaling to any number of tokens (mirrors module-list.ts).
		on(host, 'click', event => {
			const target = event.target as HTMLElement
			if (!target.closest('button.remove')) return
			const pill = target.closest('[data-key]')
			if (!(pill instanceof HTMLElement)) return
			const key = pill.dataset.key
			if (key) {
				removeToken(key)
				textbox.focus()
			}
		})

		const descriptionEl = first('.description')
		if (descriptionEl) {
			const descriptionId = descriptionEl.id
			if (descriptionId) textbox.setAttribute('aria-describedby', descriptionId)
			watch('description', bindText(descriptionEl))
		}

		const errorEl = first('.error')
		if (errorEl) watch('validationMessage', bindText(errorEl))
	},
	[formAssociated()],
)
