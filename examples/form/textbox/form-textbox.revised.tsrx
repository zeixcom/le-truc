import { type FormAssociatedElement } from '@zeix/le-truc'

export const config = {
	formAssociated: true,
}

export type FormTextboxProps = {
	/** Current text value. Sets the inner control's IDL property and marks it dirty, as a native control does. */
	value: string
	/** Reset baseline. Reflects the inner control's `value` content attribute. */
	defaultValue: string
	/** Character length of the current value (read-only). */
	readonly length: number
	/** Helper text shown below the input. May include a `{n}` remaining-characters placeholder. */
	description: string
	/** Clears the textbox and emits input/change events. Leaves the inner control dirty, so the `value` attribute no longer applies until a form reset. */
	clear: () => void
}

declare global {
	interface HTMLElementTagNameMap {
		'form-textbox': FormAssociatedElement & FormTextboxProps
	}
}

/**
 * A single-line or multiline text input with validation, optional clear button, and helper text.
 * The underlying native control provides keyboard accessibility and textbox semantics; form
 * participation and validity go through ElementInternals.
 *
 * The inner control is deliberately unnamed — `name` belongs to the host, which submits via
 * `setFormValue`. A named inner control would submit the field twice.
 *
 * Initial state is adopted from the inner control's IDL property rather than its content
 * attribute, so text typed, autofilled, or session-restored before upgrade survives.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-textbox} Interactive preview and usage examples
 **/
export function FormTextbox({
	name,
	label,
	id = name,
	value = '',
	required = false,
	maxlength = null,
	multiline = false,
	clearable = false,
	description = '',
}: {
	name: string
	label: string
	id?: string
	value?: string
	required?: boolean
	maxlength?: number | null
	multiline?: boolean
	clearable?: boolean
	description?: string
}) @{
	const inputId = `${id}-input`
	const errorId = `${id}-error`
	const descriptionId = `${id}-description`
	const validatable = required || maxlength != null
	const describedBy =
		[description ? descriptionId : null, validatable ? errorId : null]
			.filter(Boolean)
			.join(' ') || null

	const control = first('input, textarea', 'required')

	const currentValue = createCell(control.value)
	const length = deriveCell(() => currentValue.get().length)
	const helperText =
		description.includes('{n}') && maxlength != null && maxlength > 0
			? deriveCell(() =>
					description.replace('{n}', String(maxlength - length.get())),
				)
			: createCell(description)

	expose({
		value: {
			get: currentValue.get,
			set: (next: string) => {
				control.value = next
				currentValue.set(next)
				host.setFormValue(next)
			},
		},
		defaultValue: {
			get: () => control.defaultValue,
			set: (next: string) => {
				control.defaultValue = next
			},
		},
		length: length.get,
		description: helperText,
		clear: defineMethod(() => {
			control.value = ''
			control.dispatchEvent(new Event('input', { bubbles: true }))
			control.dispatchEvent(new Event('change', { bubbles: true }))
			control.focus()
		}),
		formResetCallback: defineMethod(() => {
			queueMicrotask(() => {
				currentValue.set(control.value)
				host.setFormValue(control.value)
			})
		}),
	})

	const onInput = () => {
		currentValue.set(control.value)
		host.setFormValue(control.value)
	}
	const onChange = () => {
		control.checkValidity()
		host.setCustomValidity(control.validationMessage)
	}

	<>
		<form-textbox {name} {value}>
			<label for={inputId}>{label}</label>
			<div class="input">
				@if (multiline) {
					<textarea
						id={inputId}
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
						{value}
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
						ariaLabel="Clear input"
						hidden={length.get() === 0}
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
				<p class="description" aria-live="polite" id={descriptionId}>
					{helperText}
				</p>
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

				/* :user-invalid matches only after interaction; :invalid would match on load. */
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
