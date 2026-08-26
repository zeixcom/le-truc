/**
 * TSRX migration: form-combobox — composes `form-listbox.tsrx` (ADR 0023
 * sub-design 10), the first composition in this batch between two
 * MIGRATED (not hand-written) sibling components. Two composition-specific
 * constraints shaped this file:
 * - `ComposeAttrIR` only supports `ref` | `arg` (server literal) | `pass`
 *   on a composed PascalCase element — no `hidden={…}`/`onChange={…}`
 *   directly on `<FormListbox>`. The reactive `hidden` toggle and the
 *   commit-on-selection listener both live on a plain native `<div
 *   class="popup">` wrapping the composed element instead — `hidden`
 *   toggles the wrapper (fine, CSS visibility is equivalent either way),
 *   and `onChange` catches the 'change' event form-listbox dispatches from
 *   its own host, which bubbles up through the wrapper same as any DOM
 *   event (no shadow DOM boundary to stop it).
 * - Filtering is driven by the composed listbox's `filter` prop via
 *   `truc:pass={{ filter: () => host.value }}` — `filterable` itself is passed
 *   `false` (a plain `arg`, not reactive) since form-combobox owns the only
 *   visible text input; form-listbox's OWN optional filter input/clear
 *   button UI (`filterable` prop) would be a redundant second input.
 *   form-listbox's filtering LOGIC (the per-option `hidden` thunk) reacts
 *   to `host.filter` regardless of whether its own input UI is rendered,
 *   so this composes cleanly.
 *
 * Dropped from the hand-written version: the `isExpanded` popup-visibility
 * memo also checked `listbox.options.length > 0` (don't show an empty
 * popup) — form-listbox.tsrx (LT-0xx migration) doesn't expose a live
 * `options` list of visible buttons, so visibility here is driven by
 * `showPopup` alone.
 */
import { FormListbox } from '../listbox/form-listbox.tsrx'

export type FormComboboxOption = {
	value: string
	label: string
}

export const config = { formAssociated: true }

export type FormComboboxProps = {
	/** Current text input value. Updated on each `input` event. */
	value: string
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
	}:
		{
			name: string
			label: string
			options: FormComboboxOption[]
			value?: string
			description?: string
		},
)
@{
	const inputId = `${name}-input`;
	const descriptionId = `${name}-description`;
	const showPopup = createState(false);

	expose({
		value: asString(''),
		description: asString(''),
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

	<>
		<form-combobox {name} {value}>
			<label for={inputId}>{label}</label>
			<div class="input">
				<input
					type="text"
					id={inputId}
					ref={textbox}
					value={() => host.value}
					autocomplete="off"
					role="combobox"
					aria-expanded={() => String(showPopup.get())}
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
						if (showPopup.get())
							(listbox.querySelector('button[role="option"]') as HTMLButtonElement | null)?.focus();
					}}
				/>
			</div>
			<div
				class="popup"
				hidden={() => !showPopup.get()}
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
					ref={listbox}
					truc:pass={{ filter: () => host.value }}
				/>
			</div>
			@if (description) {
				<p class="description" aria-live="polite" id={descriptionId}>{description}</p>
			}
			<p class="error" role="alert" aria-live="assertive">{host.validationMessage}</p>
		</form-combobox>

		<style>
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
		</style>
	</>
}
