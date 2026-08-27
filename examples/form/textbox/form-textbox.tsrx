/**
 * Unified-format spike: form-textbox — extension activation and the widened
 * FormFactoryContext (LT-005, ADR 0023 sub-design 8).
 *
 * Beyond basic-counter / module-tabgroup:
 * - `export const config` activates defineComponent's third argument with zero
 *   imports: the compiler validates the keys, auto-imports the extension
 *   factories (formAssociated first — it selects the FormFactoryContext
 *   overload), and emits them as the generated client's extensions array
 * - Parser-backed attribute-driven props: `expose({ value: asString('') })`
 *   seeds `value` from the HOST's `value` attribute at connect (ADR 0003).
 *   `value` is deliberately NOT in `observedAttributes` (LT-057): the
 *   attribute is the reset baseline (`host.defaultValue`), not a live-value
 *   channel — re-parsing it on every mutation would push the baseline into
 *   the live `value` prop, exactly the "reflecting overwrites the reset
 *   baseline" bug LT-057 closes from the other direction. `defaultValue` and
 *   `formResetCallback` are installed by `formAssociated()` itself (LT-056/
 *   LT-057) — a component must NOT `expose()` either, which is exactly the
 *   shadowing bug LT-058 catches at compile time.
 * - `defineMethod()` brands the `clear` method producer
 * - `value={() => host.value}` mirrors the host prop onto the control — lowers
 *   to `watch(() => host.value, bindProperty(input, 'value'))` (property
 *   dispatch, since it's a host-prop mirror — ADR 0023 sub-design 12) and is
 *   present on BOTH `@if` branches identically. This is load-bearing, not
 *   redundant: union addressing only walks the first branch that carries any
 *   client construct (`analysis/effects.ts` `handleIfEffects`), so if the two
 *   branches' `value` attributes ever diverge, the mirror silently vanishes
 *   from the generated client — see NOTES.md for the compiler-level fix this
 *   points at (LT-066: `<textarea value={…}>` should lower to text-content
 *   SSR, not an attribute, making this symmetry unnecessary). Textarea also
 *   renders its initial value as text content (`{value}`) since `value` is
 *   not a real HTML attribute there — the attribute is harmlessly ignored by
 *   the browser pre-hydration, while the text content gives the correct
 *   initial display.
 * - `{host.validationMessage}` is the managed-prop lazy child (only exists on
 *   FormFactoryContext — the emitted `watch('validationMessage', …)` typechecks
 *   only when formAssociated() leads the extensions array)
 * - `id` is a prop distinct from `name` (defaulting to it) so two instances
 *   of the component in one document don't collide on generated ids
 * - `aria-describedby` is computed once from both the description and error
 *   ids and applied identically to both branches (CHECKLIST §10: the original
 *   draft only wired it on the `input` branch, and never associated the error
 *   paragraph's own `id` with anything)
 * - `:has(.clear)` replaces the imperative `internals.states.add('clearable')`
 *   call (CHECKLIST §10) — derived from markup, so it can't drift from
 *   whether the clear button actually exists
 */
export const config = {
	formAssociated: true,
}

export type FormTextboxProps = {
	/** Current text value. Synced with the native input or textarea. */
	value: string
	/** Character length of the current value (read-only). */
	readonly length: number
	/** Helper text shown below the input. May include a `{n}` remaining-characters placeholder. */
	description: string
	/** Method to clear the textbox and emit input/change events */
	clear: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-textbox': FormAssociatedElement & FormTextboxProps
	}
}

/**
 * A single-line or multiline text input with validation, optional clear button, and helper text.
 * Use it when you need a styled text field — the underlying native input provides
 * keyboard accessibility and standard ARIA textbox semantics. Form participation
 * and validity are via ElementInternals (`formAssociated()`).
 * External consumers read `host.validationMessage` / `host.validity` like on a
 * native input; inline error display binds directly to `host.validationMessage`.
 * Sets the `:has(.clear)` style hook when a `button.clear` descendant is
 * present, so CSS can reserve space for it — derived from markup, not an
 * author-set attribute or custom state, so it can't drift out of sync.
 *
 * The inner control is deliberately unnamed — `name` belongs to the host,
 * which submits via `setFormValue`. A named inner control would submit the
 * field twice.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-textbox} Interactive preview and usage examples
 **/
export function FormTextbox(
	{
		name,
		label,
		id = name,
		value = '',
		required = false,
		maxlength = null,
		multiline = false,
		clearable = false,
		description = '',
	}:
		{
			name: string
			label: string
			id?: string
			value?: string
			required?: boolean
			maxlength?: number | null
			multiline?: boolean
			clearable?: boolean
			description?: string
		}
)
@{
	const length = createCell(value.length);
	const descriptionCell = deriveCell(() => {
		const template = description;
		return Number(maxlength) > 0 && template.includes('{n}')
			? template.replace('{n}', String(Number(maxlength) - length.get()))
			: template;
	});

	expose({
		value: asString(''),
		length: length.get,
		description: descriptionCell.get,
		clear: defineMethod(() => {
			host.value = ''
			input.value = ''
			input.setCustomValidity('')
			host.setCustomValidity('')
			input.dispatchEvent(new Event('input', { bubbles: true }))
			input.dispatchEvent(new Event('change', { bubbles: true }))
			input.focus()
		}),
	});

	const inputId = `${id}-input`;
	const errorId = `${id}-error`;
	const descriptionId = `${id}-description`;
	// Whether native validation can ever produce a validationMessage at all —
	// gates rendering the error paragraph (form-textbox.ts always rendered
	// it; here it's genuinely optional markup, so it's genuinely conditional).
	const validatable = required || maxlength != null;
	const describedBy =
		[description ? descriptionId : null, validatable ? errorId : null]
			.filter(Boolean)
			.join(' ') || null;
	// One @if branch renders <textarea>, the other <input> — a single name
	// spanning both via a comma selector (LT-055), verified structurally as
	// mutually-exclusive @if branch roots.
	const input = first('input, textarea', 'text control');

	const onInput = () => {
		length.set(input.value.length);
		host.value = input.value;
	};
	const onChange = () => {
		input.checkValidity();
		host.setCustomValidity(input.validationMessage ?? '');
		host.value = input.value;
	};

	<>
		<form-textbox {name} {value}>
			<label for={inputId}>{label}</label>
			<div class="input">
				@if (multiline) {
					<textarea
						id={inputId}
						value={() => host.value}
						autocomplete="off"
						{required}
						{maxlength}
						rows={3}
						aria-describedby={describedBy}
						{onInput}
						{onChange}
					>{value}</textarea>
				} @else {
					<input
						type="text"
						id={inputId}
						value={() => host.value}
						autocomplete="off"
						{required}
						{maxlength}
						aria-describedby={describedBy}
						{onInput}
						{onChange}
					/>
				}
				@if (clearable) {
					<button
						type="button"
						class="clear"
						aria-label="Clear input"
						hidden={() => length.get() === 0}
						onClick={() => host.clear()}
					>
						✕
					</button>
				}
			</div>
			@if (validatable) {
				<p class="error" role="alert" aria-live="assertive" id={errorId}>
					{host.validationMessage}
				</p>
			}
			@if (description) {
				<p class="description" aria-live="polite" id={descriptionId} data-remaining={description}>{descriptionCell}</p>
			}
		</form-textbox>

		<style>
			form-textbox {
				display: block;
				width: 100%;

				& label,
				& p,
				& button {
					opacity: var(--opacity-dimmed);
					transition: opacity var(--transition-short) var(--easing-inout);
				}

				& label {
					display: block;
					font-size: var(--font-size-s);
					color: var(--color-text);
					margin-bottom: var(--space-xxs);
				}

				& input,
				& textarea {
					display: inline-block;
					box-sizing: border-box;
					background: var(--color-input);
					color: var(--color-text);
					border: none;
					border-bottom: 1px solid var(--color-border);
					padding: var(--space-xs) var(--space-xxs);
					font-size: var(--font-size-m);
					width: 100%;

					&::placeholder {
						color: var(--color-text);
						opacity: var(--opacity-translucent);
					}
				}

				/* Native validity styling — replaces the old aria-invalid attribute hook.
				   :user-invalid matches after user interaction (the right UX for required
				   fields); :invalid would match immediately on page load. */
				&:user-invalid input,
				&:user-invalid textarea {
					box-shadow: 0 0 var(--space-xxs) 2px var(--color-error-invalid);
				}

				& input {
					height: var(--input-height);
				}

				/* Derived from markup, so it cannot drift from whether the button exists. */
				&:has(.clear) .input {
					position: relative;

					& input {
						padding-right: var(--input-height);
					}

					.clear {
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
					& p,
					& button {
						opacity: var(--opacity-solid);
					}
				}
			}
		</style>
	</>
}
