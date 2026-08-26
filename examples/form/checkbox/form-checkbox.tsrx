export const config = { formAssociatedCheckbox: true }

export type FormCheckboxProps = {
	/**
	 * Whether the checkbox is checked. Read from the host's own `checked`
	 * attribute at connect time — set it on `<form-checkbox>`, not the
	 * inner native input — and restored to that default on `<form>.reset()`.
	 */
	checked: boolean
	/** Visible label text of the checkbox. */
	label: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-checkbox': FormAssociatedElement & FormCheckboxProps
	}
}

/**
 * A styled checkbox component that syncs its state with a native checkbox input.
 * Use it when you need a visually customisable checkbox — the underlying native
 * input provides keyboard accessibility (Space to toggle) and ARIA semantics.
 * Form participation is via ElementInternals (`formAssociatedCheckbox()`) —
 * submits nothing when unchecked, matching native `<input type="checkbox">`.
 * Set `name` and `value` on `<form-checkbox>` itself, not the inner native
 * input — the host is the sole source of truth for form submission; the
 * inner input's own `name`/`value` (if any) are inert.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-checkbox} Interactive preview and usage examples
 **/
export function FormCheckbox(
	{
		name,
		label,
		checked = false,
	}:
		{
			name: string
			label: string
			checked?: boolean
		},
)
@{
	expose({
		checked: asBoolean(false),
	});

	<>
		<form-checkbox {name} {checked}>
			<label>
				<input
					type="checkbox"
					checked={() => host.checked}
					disabled={() => host.disabled}
					ref={checkbox}
					onChange={() => ({ checked: checkbox.checked })}
				/>
				<span class="label">{label}</span>
			</label>
		</form-checkbox>

		<style>
		form-checkbox {
			display: inline-block;
			flex-grow: 1;

			& input:focus {
				outline: none;
				box-shadow: none;
			}

			& label {
				font-size: var(--font-size-s);
				border-radius: var(--space-xs);
			}

			&:has(input:focus-visible) label {
				box-shadow: 0 0 var(--space-xxs) 2px var(--color-selection);
			}
		}
		</style>
	</>
}
