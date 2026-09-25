/**
 * TSX spike port (LT-183) of examples/form/listbox/form-listbox.tsrx —
 * semantically identical. The two `@if (filterable) { <input/> }` blocks
 * become `{filterable && <input/>}` (single-branch `if` IR); the
 * `@for (const option of options; index i) { hoisted consts; <button/> }`
 * becomes `options.map((option, i) => { hoisted consts; return <button/> })`
 * — same ForIR (item, index, iterable, hoisted), the dual lowering decision
 * stays the analysis's. Setup statements are copied verbatim.
 *
 * Lives beside its `.tsrx` twin as a variant set (ADR 0039). Every member
 * declares its own `HTMLElementTagNameMap` entry (s4): the served member's
 * generated client must carry it.
 */

import type { FormFactoryContext } from '@zeix/le-truc'
import { asString, defineMethod } from '@zeix/le-truc'

/**
 * The filter input's placeholder and the clear button's aria-label are
 * component-owned text (the placeholder is read by assistive tech, the
 * label is what it announces), so they route through the reserved `i18n`
 * parameter (ADR 0030): the compiler resolves `t` per locale at render
 * time; this inline record is the source-locale fallback every catalog
 * resolves against. `ariaLabel` (the listbox's own label) is author data
 * and stays a prop.
 */
export const i18n = {
	filter: 'Filter',
	clearFilter: 'Clear filter',
}

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
	/**
	 * Every option, in document order, regardless of the filter (read-only,
	 * derived). The unfiltered projection of the option buttons this
	 * component owns — module-listnav maps the URL hash onto it instead of
	 * querying inside this component's markup (LT-332).
	 */
	readonly options: FormListboxOption[]
	/**
	 * The options currently passing the filter, in document order (read-only,
	 * derived). Composing parents gate their own UI on this — form-combobox
	 * hides its popup when the list is empty — instead of reaching into the
	 * option buttons this component owns (LT-119).
	 */
	readonly visibleOptions: FormListboxOption[]
	/**
	 * Moves focus to the first option still passing the filter, if any. The
	 * public entry point for a composing parent's "open the popup and step
	 * into it" key handler (LT-120).
	 */
	focusFirstOption: () => void
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
		i18n: { t },
	}: {
		name: string
		ariaLabel?: string
		options: FormListboxOption[]
		value?: string
		filterable?: boolean
		i18n: I18n
		/**
		 * Compiler-consumed compose surface (truc:pass), never a render
		 * arg — the `.tsx` surface's answer to ADR 0024 s10: a composed
		 * child declares its pass-able props on its args type so a
		 * parent's `truc:pass={{ … }}` type-checks against the child's
		 * real shape.
		 */
		'truc:pass'?: { filter?: () => string }
	},
	{ host, all, expose }: FormFactoryContext<FormListboxProps>,
) {
	expose({
		value: asString(''),
		filter: asString(''),
		// Children-are-data (LT-119): the rendered option buttons ARE the
		// option list, so the public projection is read back off them
		// (`data-value`/`data-label`, the same pair the loop writes) rather
		// than off the server `options` arg, which the client half never
		// receives. The arg renders the buttons, the prop reads them back:
		// one site in three roles (LT-332). `visibleOptions` repeats the
		// per-option `hidden` predicate below; both read `host.filter`, so
		// both stay live.
		options: () =>
			all('button[role="option"]')
				.get()
				.map((el: HTMLElement) => ({
					value: el.getAttribute('data-value') ?? '',
					label: el.getAttribute('data-label') ?? '',
				})),
		visibleOptions: () =>
			host.options.filter((option: FormListboxOption) =>
				option.label.toLowerCase().includes(host.filter.toLowerCase()),
			),
		focusFirstOption: defineMethod(() => {
			all('button[role="option"]:not([hidden])').get()[0]?.focus()
		}),
	})

	return (
		<>
			<form-listbox name={name} value={value || options[0]?.value || ''}>
				<div class="input">
					{filterable && (
						<input
							type="text"
							class="filter"
							placeholder={t.filter}
							onInput={(e: Event) => ({
								filter: (e.target as HTMLInputElement).value,
							})}
						/>
					)}
					{filterable && (
						<button
							type="button"
							class="clear"
							aria-label={t.clearFilter}
							hidden={() => !host.filter}
							onClick={() => ({ filter: '' })}
						>
							✕
						</button>
					)}
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
						const current = elements.indexOf(
							document.activeElement as HTMLButtonElement,
						)
						const next =
							key === 'Home'
								? 0
								: key === 'End'
									? elements.length - 1
									: (current +
											(key === 'ArrowDown' ? 1 : -1) +
											elements.length) %
										elements.length
						elements[next]?.focus()
					}}
					onKeyup={(e: KeyboardEvent) => {
						if (e.key !== 'Enter') return
						if (document.activeElement instanceof HTMLButtonElement)
							document.activeElement.click()
					}}
				>
					{options.map((option, i) => {
						const optValue = option.value
						const optLabel = option.label
						return (
							<button
								type="button"
								role="option"
								data-value={optValue}
								data-label={optLabel}
								tabindex={() => (host.value === optValue ? 0 : -1)}
								aria-selected={() => String(host.value === optValue)}
								hidden={() =>
									!optLabel.toLowerCase().includes(host.filter.toLowerCase())
								}
								onClick={() => {
									host.value = optValue
									host.dispatchEvent(new Event('change', { bubbles: true }))
								}}
							>
								{optLabel}
							</button>
						)
					})}
				</div>
			</form-listbox>

			<style>{css`
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
			`}</style>
		</>
	)
}
