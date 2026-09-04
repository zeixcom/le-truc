/**
 * TSRX migration: form-tokenbox — the token pills are a reactive `createList`
 * reconciled via `@for (const token of tokens; key k)` (ADR 0023 sub-design
 * 5/17, same lowering module-list.tsrx already proves). `validateListBody`
 * only allows statics, event attributes, and exactly one lazy `{item}`
 * text hole in the item body — no dynamic attributes — so the remove
 * button's `aria-label` can't carry the per-token value
 * (`aria-label={`Remove ${value}`}` in the hand-written version); it's a
 * static "Remove" here, relying on the adjacent visible token text for
 * context. `commit()`/`removeToken()` aren't hoisted into shared setup
 * consts (unlike the hand-written version) — a plain setup const that reads
 * `host`/refs breaks server compilation once TSRX emits it verbatim into the
 * server module too (found migrating form-inplace-edit.tsrx) — so both are
 * inlined at each of their two call sites instead.
 *
 * The reactive list's seed must be a pure literal or reference bare server
 * args only (`analysis/harvest.ts`'s List-seed harvest gate) — a
 * `splitTokens(value)` call doesn't qualify (`splitTokens` isn't a server
 * arg), so the initial seed inlines a simpler split/trim/filter expression
 * over `value` directly and skips `splitTokens`'s case-insensitive dedup for
 * that one initial read; `tokens.add()`'s own `DuplicateKeyError` guard
 * still catches duplicates from then on, same as the hand-written version.
 */
import { createList, defineMethod } from '@zeix/le-truc'
import { DuplicateKeyError } from '@zeix/le-truc'

export const config = { formAssociated: true }

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

/**
 * A tokenized text input: typed text becomes a removable pill on `,` or on blur,
 * gated by the native input's own constraint validation (`pattern`, `maxlength`, …
 * left on the descendant `<input>` still apply to each candidate token). Form
 * participation and validity are via ElementInternals (`formAssociated()`); the
 * exposed `value` is the committed tokens joined by `", "`.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-tokenbox} Interactive preview and usage examples
 **/
export function FormTokenbox(
	{
		name,
		label,
		value = '',
		type = 'text',
		description = '',
	}:
		{
			name: string
			label: string
			value?: string
			type?: string
			description?: string
		},
)
@{
	const splitTokens = (raw: string): string[] => {
		const seen = new Set<string>()
		return raw
			.split(',')
			.map(part => part.trim())
			.filter(part => {
				if (!part) return false
				const key = part.toLowerCase()
				if (seen.has(key)) return false
				seen.add(key)
				return true
			})
	}
	const tokens = createList<string>(
		value.split(',').map(part => part.trim()).filter(Boolean),
		{ keyConfig: v => v.toLowerCase() },
	)
	const inputId = `${name}-input`
	const descriptionId = `${name}-description`
	const textbox = first('input', 'token input')
	const descriptionEl = first('.description')
	const statusEl = first('.status', 'status paragraph')

	expose({
		value: {
			get: () => tokens.get().join(', '),
			set: (v: string) => tokens.set(splitTokens(v)),
		},
		description: descriptionEl?.textContent ?? '',
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

	<>
		<form-tokenbox {name} value={value}>
			<label for={inputId}>{label}</label>
			<div class="input" data-container>
				@for (const token of tokens; key k) {
					<span class="token" data-key>
						<span class="token-label">{token}</span>
						<button
							type="button"
							class="remove"
							aria-label="Remove"
							onClick={() => {
								const removedValue = tokens.byKey(k)?.get()
								tokens.remove(k)
								if (removedValue) statusEl.textContent = `Removed token: ${removedValue}`
								textbox.focus()
							}}
						>✕</button>
					</span>
				}
				<input
					{type}
					id={inputId}
					aria-describedby={description ? descriptionId : null}
					onKeydown={(e: KeyboardEvent) => {
						if (e.key === ',' || e.key === 'Enter') {
							e.preventDefault()
							const trimmed = textbox.value.trim()
							if (!trimmed) return
							textbox.value = trimmed
							if (!textbox.checkValidity()) {
								host.setCustomValidity(textbox.validationMessage)
								return
							}
							try {
								tokens.add(trimmed)
								host.setCustomValidity('')
							} catch (err) {
								if (err instanceof DuplicateKeyError) {
									host.setCustomValidity(`${trimmed} is already in the list`)
									return
								}
								throw err
							}
							textbox.value = ''
							statusEl.textContent = `Added token: ${trimmed}`
						} else if (e.key === 'Backspace' && textbox.value === '') {
							const lastKey = tokens.keyAt(tokens.length - 1)
							if (lastKey) {
								const removedValue = tokens.byKey(lastKey)?.get()
								tokens.remove(lastKey)
								if (removedValue) statusEl.textContent = `Removed token: ${removedValue}`
							}
						}
					}}
					onBlur={() => {
						const trimmed = textbox.value.trim()
						if (!trimmed) return
						textbox.value = trimmed
						if (!textbox.checkValidity()) {
							host.setCustomValidity(textbox.validationMessage)
							return
						}
						try {
							tokens.add(trimmed)
							host.setCustomValidity('')
						} catch (err) {
							if (err instanceof DuplicateKeyError) {
								host.setCustomValidity(`${trimmed} is already in the list`)
								return
							}
							throw err
						}
						textbox.value = ''
						statusEl.textContent = `Added token: ${trimmed}`
					}}
				/>
			</div>
			<p class="error" role="alert" aria-live="assertive">
				{host.validationMessage}
			</p>
			@if (description) {
				<p class="description" aria-live="polite" id={descriptionId}>
					{description}
				</p>
			}
			<p class="status visually-hidden" role="status" aria-live="polite"></p>
		</form-tokenbox>

		<style>
		form-tokenbox {
			display: block;
			width: 100%;

			& label,
			& p {
				opacity: var(--opacity-dimmed);
				transition: opacity var(--transition-short) var(--easing-inout);
			}

			& label {
				display: block;
				font-size: var(--font-size-s);
				color: var(--color-text);
				margin-bottom: var(--space-xxs);
			}

			& .input {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: var(--space-xxs);
				box-sizing: border-box;
				min-height: var(--input-height);
				background: var(--color-input);
				border: none;
				border-bottom: 1px solid var(--color-border);
				padding: var(--space-xxs);
			}

			& input {
				flex: 1 1 8ch;
				min-width: 8ch;
				box-sizing: border-box;
				border: none;
				background: transparent;
				color: var(--color-text);
				font-size: var(--font-size-m);
				padding: var(--space-xxs);
				line-height: var(--line-height-s);

				&:focus {
					outline: none;
					box-shadow: none;
				}

				&::placeholder {
					color: var(--color-text);
					opacity: var(--opacity-translucent);
				}
			}

			& .input:has(input:focus-visible) {
				box-shadow: 0 0 var(--space-xxs) 2px var(--color-selection);
			}

			&:invalid .input:has(input:invalid) {
				box-shadow: 0 0 var(--space-xxs) 2px var(--color-error-invalid);
			}

			& .token {
				display: inline-flex;
				align-items: center;
				gap: var(--space-xxs);
				background: var(--color-secondary);
				color: var(--color-text);
				border-radius: var(--space-l);
				padding: 0 0 0 var(--space-m);
				font-size: var(--font-size-s);
				line-height: var(--line-height-s);

				.remove {
					border: 0;
					border-radius: 50%;
					font-size: var(--font-size-xs);
					line-height: var(--line-height-xs);
					color: var(--color-text-soft);
					background-color: var(--color-secondary);
					width: var(--space-l);
					height: var(--space-l);
					padding: 0;
					cursor: pointer;

					&:hover {
						color: var(--color-text);
						background-color: var(--color-secondary-hover);
					}
				}
			}

			.error,
			.description {
				margin: var(--space-xs) 0 0;
				font-size: var(--font-size-xs);
				line-height: var(--line-height-s);

				&:empty {
					display: none;
				}
			}

			.error {
				color: color-mix(in srgb, var(--color-text) 50%, var(--color-error));
			}

			.description {
				color: var(--color-text-soft);
			}

			&:focus-within {
				& label,
				& p {
					opacity: var(--opacity-solid);
				}
			}
		}
		</style>
	</>
}
