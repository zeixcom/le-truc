/**
 * TSRX migration: form-listbox — the hand-written version supports three
 * structurally different demo shapes: a flat declarative option list, a
 * grouped option list (`role="group"` sections), and a remote-fetch mode
 * that loads JSON and injects server-formatted HTML via `innerHTML`
 * (`createTask` + raw HTML string building). This migration keeps only the
 * flat-options + filter shape — the one with a clean typed-props mapping —
 * and drops both variants that don't fit the compiler's current feature set:
 * - Grouped options would need a `@for` nested inside a `@for` (groups, then
 *   each group's items); no corpus component exercises nested `@for` yet,
 *   and the two-level hoisted-const/selector-scoping story isn't proven.
 * - The remote-fetch mode's async `@try`/`@pending`/`@catch` boundary
 *   requires the guarded `deriveCell(async …)` signal to be the ok-arm
 *   root's DIRECT LAZY CHILD (`&{content}`, rendered as escaped TEXT) —
 *   the hand-written version needs raw, unescaped HTML injection instead
 *   (`listbox.innerHTML = html`), which is a different construct
 *   (`html={() => …}`) that async `@try` doesn't route through.
 * Both are real behavior drops, not workarounds — left as follow-ups if a
 * second use case justifies the compiler work.
 *
 * Per-item `tabindex`/`aria-selected`/`hidden` reactive attributes on the
 * `@for` loop's own OUTPUT ROOT (the `<button role="option">` itself, no
 * wrapping element needed) — unlike form-radiogroup.tsrx's nested
 * `<label><input></label>`, this component's one interactive unit per item
 * IS the loop's root, so it doesn't exercise the LT-037 nested-descendant
 * fix at all, just the already-supported root-level case.
 *
 * The filter input/clear-button pair is guarded by two SEPARATE
 * `@if (filterable) { … }` blocks (one per element), not one `@if` wrapping
 * both inside a shared `<div class="input">` — a single-branch `@if`
 * requires every client construct to sit on ITS OWN root element; deeper
 * elements (the input/button nested a level inside the `@if`'s wrapping
 * div) aren't walked, same category of gap as LT-037 but for `@if` instead
 * of `@for`, not fixed here. The wrapping `<div class="input">` itself
 * stays unconditional (renders empty when `filterable` is false) so its
 * two children can each be their own single-element `@if` root.
 */
export const config = { formAssociated: true }

export type FormListboxOption = {
	value: string
	label: string
}

export type FormListboxProps = {
	/** Currently selected option value. */
	value: string
	/** Filter string used to narrow displayed options. */
	filter: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-listbox': FormAssociatedElement & FormListboxProps
	}
}

/**
 * A filterable listbox of declarative options that integrates with HTML forms.
 * Use it for searchable, single-select option lists — provides ARIA listbox
 * semantics, keyboard navigation (Arrow, Home, End), and form participation
 * via ElementInternals.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-listbox} Interactive preview and usage examples
 **/
export function FormListbox(
	{
		name,
		ariaLabel,
		options,
		value = '',
		filterable = false,
	}:
		{
			name: string
			ariaLabel?: string
			options: FormListboxOption[]
			value?: string
			filterable?: boolean
		},
)
@{
	expose({
		value: asString(''),
		filter: asString(''),
	});

	<>
		<form-listbox {name} value={value || options[0]?.value || ''}>
			<div class="input">
				@if (filterable) {
					<input
						type="text"
						class="filter"
						placeholder="Filter"
						onInput={(e: Event) => ({ filter: (e.target as HTMLInputElement).value })}
					/>
				}
				@if (filterable) {
					<button
						type="button"
						class="clear"
						aria-label="Clear filter"
						hidden={() => !host.filter}
						onClick={() => ({ filter: '' })}
					>✕</button>
				}
			</div>
			<div
				role="listbox"
				aria-label={ariaLabel ?? ''}
				onKeydown={(e: KeyboardEvent) => {
					const { key } = e
					if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return
					const elements = all('button[role="option"]:not([hidden])').get()
					e.preventDefault()
					e.stopPropagation()
					const current = elements.indexOf(document.activeElement as HTMLButtonElement)
					const next =
						key === 'Home'
							? 0
							: key === 'End'
								? elements.length - 1
								: (current + (key === 'ArrowDown' ? 1 : -1) + elements.length) % elements.length
					elements[next]?.focus()
				}}
				onKeyup={(e: KeyboardEvent) => {
					if (e.key !== 'Enter') return
					if (document.activeElement instanceof HTMLButtonElement)
						document.activeElement.click()
				}}
			>
				@for (const option of options; index i) {
					const optValue = option.value
					const optLabel = option.label
					<button
						type="button"
						role="option"
						data-value={optValue}
						data-label={optLabel}
						tabindex={() => (host.value === optValue ? 0 : -1)}
						aria-selected={() => String(host.value === optValue)}
						hidden={() => !optLabel.toLowerCase().includes(host.filter.toLowerCase())}
						onClick={() => {
							host.value = optValue
							host.dispatchEvent(new Event('change', { bubbles: true }))
						}}
					>{optLabel}</button>
				}
			</div>
		</form-listbox>

		<style>
		form-listbox {
			display: block;
			margin: 0;

			.input {
				position: relative;
				margin-bottom: var(--space-m);

				& input.filter {
					display: inline-block;
					box-sizing: border-box;
					background: var(--color-input);
					color: var(--color-text);
					border: none;
					border-bottom: 1px solid var(--color-border);
					padding: var(--space-xs) var(--input-height) var(--space-xs)
						var(--space-xxs);
					font-size: var(--font-size-m);
					width: 100%;
					height: var(--input-height);

					&::placeholder {
						color: var(--color-text);
						opacity: var(--opacity-translucent);
					}
				}

				& button.clear {
					position: absolute;
					bottom: 0;
					right: 0;
					border: 0;
					border-radius: 50%;
					font-size: var(--font-size-xs);
					line-height: var(--line-height-xs);
					color: var(--color-input);
					background-color: var(--color-text-soft);
					width: calc(0.6 * var(--input-height));
					height: calc(0.6 * var(--input-height));
					margin: calc(0.2 * var(--input-height));
					padding: 0;

					&:hover {
						background-color: var(--color-text);
					}
				}
			}

			[role="listbox"] {
				display: flex;
				flex-direction: column;
				gap: 0;
				list-style: none;
				padding: 0;
				margin: 0;
				background: var(--color-input);
			}

			[role="option"] {
				display: block;
				width: 100%;
				text-align: left;
				margin: 0;
				padding: var(--space-xs) var(--space-m);
				border: 0;
				font-size: var(--font-size-s);
				line-height: var(--line-height-s);
				background: transparent;
				color: var(--color-text);
				cursor: pointer;
				transition: background var(--transition-short) var(--easing-inout);

				&[aria-selected="true"] {
					background: var(--color-selection-selected);
					color: var(--color-text-inverted);
				}

				&:hover {
					background: var(--color-selection-hover);

					&[aria-selected="true"] {
						background: var(--color-selection-active);
					}
				}
			}
		}
		</style>
	</>
}
