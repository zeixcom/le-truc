/**
 * TSX spike port (LT-183) of examples/form/combobox/form-combobox.tsrx —
 * semantically identical. The two `@if` blocks become `&&` expressions; the
 * compose import points at the ported `.tsx` sibling, whose parameter type
 * declares the compiler-consumed `'truc:pass'` key so the parent's
 * `truc:pass={{ … }}` type-checks against the CHILD'S REAL ARGS (the §8
 * negative test exploits exactly this). Setup statements are copied verbatim.
 */
import { bindAttribute, createCell, createState, asString, defineMethod } from '@zeix/le-truc'
import { FormListbox } from '../listbox/form-listbox.tsx'

export type FormComboboxOption = {
	value: string
	label: string
}

export const config = { formAssociated: true }

export type FormComboboxProps = {
	/** Current text input value. Updated on each `input` event. */
	value: string
	/** Number of characters in the current value (read-only, derived). */
	readonly length: number
	/** Helper text shown below the input. */
	description: string
	/** Clears the input and dispatches `input` and `change` events. */
	clear: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-combobox': FormAssociatedElement & FormComboboxProps
	}
}

/**
 * A combobox (searchable select) that combines a text input with a filterable listbox popup.
 * Use it for searchable selection — provides ARIA roles for the combobox pattern,
 * keyboard interaction (type to filter, Escape to close, Enter to select), and focus management.
 * Form participation and validity are via ElementInternals (`formAssociated()`).
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-combobox} Interactive preview and usage examples
 **/
export function FormCombobox(
	{
		name,
		label,
		options,
		value = '',
		description = '',
		clearable = false,
	}:
		{
			name: string
			label: string
			options: FormComboboxOption[]
			value?: string
			description?: string
			clearable?: boolean
		},
) {
	const inputId = `${name}-input`;
	const descriptionId = `${name}-description`;
	const showPopup = createState(false);
	const textbox = first('input', 'combobox input');
	const listbox = first('form-listbox', 'combobox listbox');
	const popup = first('.popup', 'listbox popup wrapper');
	const descriptionEl = first('.description');

	expose({
		value: asString(''),
		length: () => host.value.length,
		description: descriptionEl?.textContent ?? '',
		clear: defineMethod(() => {
			host.value = '';
			textbox.value = '';
			textbox.setCustomValidity('');
			textbox.checkValidity();
			textbox.dispatchEvent(new Event('input', { bubbles: true }));
			textbox.dispatchEvent(new Event('change', { bubbles: true }));
			textbox.focus();
		}),
	});

	// LT-119: popup visibility also requires at least one matching option —
	// read from the composed listbox's public `visibleOptions` prop. Both
	// watches are deliberately CLIENT-ONLY setup statements (copied
	// verbatim from the .tsrx original — see its comment block).
	watch(
		() => String(showPopup.get() && (listbox.visibleOptions?.length ?? 0) > 0),
		bindAttribute(textbox, 'aria-expanded'),
	);
	watch(
		() => !(showPopup.get() && (listbox.visibleOptions?.length ?? 0) > 0),
		bindAttribute(popup, 'hidden'),
	);

	return (
		<>
			<form-combobox name={name} value={value}>
				<label for={inputId}>{label}</label>
				<div class="input">
					<input
						type="text"
						id={inputId}
						value={() => host.value}
						autocomplete="off"
						role="combobox"
						aria-expanded="false"
						aria-describedby={description ? descriptionId : null}
						onInput={() => {
							host.value = textbox.value;
							textbox.checkValidity();
							host.setCustomValidity(textbox.validationMessage ?? '');
							showPopup.set(true);
						}}
						onKeyup={(e: KeyboardEvent) => {
							if (e.key === 'Escape') {
								showPopup.set(false);
								textbox.focus();
							}
							if (e.key === 'Delete') host.clear();
						}}
						onKeydown={(e: KeyboardEvent) => {
							if (e.key !== 'ArrowDown') return;
							if (e.altKey) showPopup.set(true);
							if (showPopup.get()) listbox.focusFirstOption();
						}}
					/>
					{clearable && (
						<button
							type="button"
							class="clear"
							aria-label="Clear input"
							hidden={() => host.value === ''}
							onClick={() => host.clear()}
						>✕</button>
					)}
				</div>
				<div
					class="popup"
					hidden
					onChange={() => {
						textbox.value = listbox.value;
						host.value = listbox.value;
						textbox.checkValidity();
						host.setCustomValidity(textbox.validationMessage ?? '');
						showPopup.set(false);
						textbox.focus();
					}}
				>
					<FormListbox
						name={`${name}-options`}
						options={options}
						filterable={false}
						truc:pass={{ filter: () => host.value }}
					/>
				</div>
				{description && (
					<p class="description" aria-live="polite" id={descriptionId}>
						{description}
					</p>
				)}
				<p class="error" role="alert" aria-live="assertive">
					{host.validationMessage}
				</p>
			</form-combobox>

			<style>{`
			form-combobox {
				display: block;
				width: 100%;

				> label,
				> p {
					opacity: var(--opacity-dimmed);
					transition: opacity var(--transition-short) var(--easing-inout);
				}

				> label {
					display: block;
					font-size: var(--font-size-s);
					color: var(--color-text);
					margin-bottom: var(--space-xxs);
				}

				> .input {
					position: relative;

					> input {
						display: inline-block;
						box-sizing: border-box;
						background: var(--color-input);
						color: var(--color-text);
						border: none;
						border-bottom: 1px solid var(--color-border);
						padding: var(--space-xs) var(--space-xxs);
						font-size: var(--font-size-m);
						height: var(--input-height);
						width: 100%;
						transition: color var(--transition-short) var(--easing-inout);

						&::placeholder {
							color: var(--color-text);
							opacity: var(--opacity-translucent);
						}
					}
				}

				/* Native validity styling — replaces the old aria-invalid attribute hook. */
				&:user-invalid > .input > input {
					box-shadow: 0 0 var(--space-xxs) 2px var(--color-error-invalid);
				}

				> .popup {
					position: absolute;
					width: calc(100% - 2px);
					border: 1px solid var(--color-border);
					border-top: none;
					z-index: 1;

					form-listbox {
						display: block;
					}
				}

				> .error,
				> .description {
					margin: var(--space-xs) 0 0;
					font-size: var(--font-size-xs);
					line-height: var(--line-height-s);

					&:empty {
						display: none;
					}
				}

				> .error {
					color: color-mix(in srgb, var(--color-text) 50%, var(--color-error));
				}

				> .description {
					color: var(--color-text-soft);
				}

				&:focus-within {
					> label,
					> p {
						opacity: var(--opacity-solid);
					}

					> .input > input {
						color: var(--color-text);
					}
				}
			}
			`}</style>
		</>
	)
}
