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
 * The twin's `isExpanded` popup-visibility memo also checked
 * `listbox.options.length > 0` (don't show an empty popup). Restored in
 * LT-119 through form-listbox's `visibleOptions` public prop — see the two
 * client-only `watch` statements below for why it is not a reactive JSX
 * attribute.
 */
import { bindAttribute, createCell, createState, asString, defineMethod } from '@zeix/le-truc'
import { FormListbox } from '../listbox/form-listbox.tsrx'

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
)
@{
	const inputId = `${name}-input`;
	const descriptionId = `${name}-description`;
	const showPopup = createState(false);
	const textbox = first('input', 'combobox input');
	const listbox = first('form-listbox', 'combobox listbox');
	const popup = first('.popup', 'listbox popup wrapper');
	// Children-are-data (LT-112/113): the description is a writable prop
	// (createCell) whose client-side seed is harvested from the owned
	// paragraph's text content; consumers compose through the public prop.
	const descriptionCell = createCell(description);

	expose({
		value: asString(''),
		length: () => host.value.length,
		description: descriptionCell,
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

	// LT-119: the twin's popup-visibility memo also required at least one
	// matching option (`options.length > 0`) — restored by reading the
	// composed listbox's public `visibleOptions` prop instead of counting the
	// option buttons it owns. Both the popup's `hidden` and the combobox's
	// own `aria-expanded` go through the one predicate, as they did in the
	// twin.
	//
	// Deliberately CLIENT-ONLY setup statements (the LT-069/LT-070
	// form-inplace-edit precedent) rather than reactive JSX attributes: the
	// predicate reads a ref, so the server cannot fold it, and as attribute
	// thunks both attributes would be silently OMITTED from the initial HTML
	// (TSRX034) — which for `hidden` means serving the popup OPEN until
	// hydration. The template carries the closed state statically instead
	// (`hidden`, `aria-expanded="false"`), which is what the server rendered
	// anyway with `showPopup` seeded false, and these two watches take over
	// from the first binding pass.
	//
	// The predicate is repeated rather than hoisted into a shared const: the
	// signal-render credit above is established per STATEMENT, and a const
	// would put `showPopup.get()` one level of indirection away from both.
	watch(
		() => String(showPopup.get() && (listbox.visibleOptions?.length ?? 0) > 0),
		bindAttribute(textbox, 'aria-expanded'),
	);
	watch(
		() => !(showPopup.get() && (listbox.visibleOptions?.length ?? 0) > 0),
		bindAttribute(popup, 'hidden'),
	);

	<>
		<form-combobox {name} {value}>
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
				@if (clearable) {
					<button
						type="button"
						class="clear"
						aria-label="Clear input"
						hidden={() => host.value === ''}
						onClick={() => host.clear()}
					>✕</button>
				}
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
			@if (description) {
				<p
					class="description"
					aria-live="polite"
					id={descriptionId}
					data-description={description}
				>{descriptionCell}</p>
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
