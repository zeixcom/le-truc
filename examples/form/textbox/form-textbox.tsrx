/**
 * Unified-format spike: form-textbox — extension activation, attribute-driven
 * props, and the widened FormFactoryContext (LT-005, ADR 0023 sub-design 8).
 *
 * Beyond basic-counter / module-tabgroup:
 * - `export const config` activates defineComponent's third argument with zero
 *   imports: the compiler validates the keys, auto-imports the extension
 *   factories (formAssociated first — it selects the FormFactoryContext
 *   overload), and emits them as the generated client's extensions array
 * - Parser-backed attribute-driven props: `expose({ value: asString('') })`
 *   seeds `value` from the HOST's `value` attribute at connect (ADR 0003);
 *   `observedAttributes: ['value']` re-parses it on later mutations
 * - `defineMethod()` brands the `clear` method producer
 * - `value={() => host.value}` mirrors the host prop onto the input — lowers
 *   to `watch(() => host.value, bindProperty(input, 'value'))` and
 *   server-renders from the root attribute expression
 * - `&{'validationMessage'}` is the managed-prop lazy child (only exists on
 *   FormFactoryContext — the emitted `watch('validationMessage', …)` typechecks
 *   only when formAssociated() leads the extensions array)
 */
export const config = {
	formAssociated: true,
	observedAttributes: ['value'],
}

export type FormTextboxProps = {
	/** Current text value. Synced with the native input or textarea. */
	value: string
	/** Character length of the current value (read-only). */
	readonly length: number
	/** Helper text shown below the input. May include a remaining-characters template. */
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
 * Sets the `:state(clearable)` custom state when a `button.clear` descendant
 * is present, so CSS can reserve space for it — derived from markup, not an
 * author-set attribute, so it can't drift out of sync or be spoofed.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-textbox} Interactive preview and usage examples
 **/
export function FormTextbox(
	{
		name,
		label,
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

	expose({
		value: asString(''),
		length: length.get,
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

	const inputId = `${name}-input`;
	const errorId = `${name}-error`;
	const descriptionId = `${name}-description`;
	// Whether native validation can ever produce a validationMessage at all —
	// gates rendering the error paragraph (form-textbox.ts always rendered
	// it; here it's genuinely optional markup, so it's genuinely conditional).
	const validatable = required || maxlength != null;

	const onInput = () => {
		length.set(input.value.length);
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
						ref={input}
						{onInput}
						{onChange}
					/>
				} @else {
					<input
						type="text"
						id={inputId}
						value={() => host.value}
						autocomplete="off"
						{required}
						{maxlength}
						aria-describedby={description ? descriptionId : null}
						ref={input}
						{onInput}
						{onChange}
					/>
				}
				@if (clearable) {
					internals?.states.add('clearable');
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
					&{'validationMessage'}
				</p>
			}
			@if (description) {
				<p class="description" aria-live="polite" id={descriptionId}>{description}</p>
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

				&:state(clearable) .input {
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
