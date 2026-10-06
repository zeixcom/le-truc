/**
 * `.tsx` spelling of examples/form/checkbox/form-checkbox.tsrx (LT-464) —
 * semantically identical. Keeps the `label: string` arg; the switch to
 * `children` lands in LT-463.
 *
 * Lives beside its `.tsrx` twin as a variant set (ADR 0039). Every member
 * declares its own `HTMLElementTagNameMap` entry (s4): the served member's
 * generated client must carry it.
 */

import type { FormFactoryContext } from '@zeix/le-truc'
import { asBoolean } from '@zeix/le-truc'
import { css } from '@zeix/le-truc-compiler/macros'

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
	}: {
		name: string
		label: string
		checked?: boolean
	},
	{ host, first, expose }: FormFactoryContext<FormCheckboxProps>,
) {
	const checkbox = first('input', 'checkbox input')
	expose({
		checked: asBoolean(false),
	})

	return (
		<form-checkbox name={name} checked={checked}>
			<label>
				<input
					type="checkbox"
					checked={() => host.checked}
					disabled={() => host.disabled}
					onChange={() => ({ checked: checkbox.checked })}
				/>
				<span class="label">{label}</span>
			</label>

			<style>{css`
			:host {
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

				&.checkbox label {
					display: inline-flex;
					gap: var(--space-s);
					line-height: var(--input-height);
					cursor: pointer;
					align-items: center;

					&::before {
						display: inline-block;
						box-sizing: border-box;
						content: " ";
						text-align: center;
						width: var(--space-l);
						height: var(--space-l);
						line-height: 1.5;
						border: 1px solid var(--color-border);
						border-radius: var(--space-xs);
						background-color: var(--color-secondary);
					}

					&:hover::before {
						background-color: var(--color-secondary-hover);
						opacity: var(--opacity-solid);
					}

					&:active::before {
						background-color: var(--color-secondary-active);
					}
				}

				&.checkbox:has(input:checked) label {
					&::before {
						color: var(--color-text-inverted);
						background-color: var(--color-selection-selected);
						border-color: var(--color-selection-active);
						text-shadow: 0 0 var(--space-xs) var(--color-success-active);
						content: "✔︎";
					}

					&:hover::before {
						background-color: var(--color-selection-active);
					}

					&:active::before {
						background-color: var(--color-selection-active);
					}
				}

				&.todo label {
					display: inline-flex;
					gap: var(--space-s);
					line-height: var(--input-height);
					cursor: pointer;
					align-items: center;

					&::before {
						display: inline-block;
						box-sizing: border-box;
						content: " ";
						text-align: center;
						width: var(--space-l);
						height: var(--space-l);
						line-height: 1.5;
						border: 1px solid var(--color-border);
						border-radius: var(--space-xs);
						background-color: var(--color-secondary);
					}

					&:hover::before {
						background-color: var(--color-secondary-hover);
						opacity: var(--opacity-solid);
					}

					&:active::before {
						background-color: var(--color-secondary-active);
					}
				}

				&.todo:has(input:checked) label {
					opacity: var(--opacity-translucent);

					& span {
						text-decoration: line-through;
					}

					&::before {
						color: var(--color-text-inverted);
						background-color: var(--color-success);
						border-color: var(--color-success-active);
						text-shadow: 0 0 var(--space-xs) var(--color-success-active);
						content: "✔︎";
					}

					&:hover::before {
						background-color: var(--color-success-hover);
					}

					&:active::before {
						background-color: var(--color-success-active);
					}
				}

				&.toggle label {
					--toggle-knob-size: calc(var(--space-l) * 2);

					display: inline-flex;
					gap: var(--space-s);
					line-height: var(--input-height);
					cursor: pointer;
					align-items: center;

					&::before {
						display: inline-block;
						flex-shrink: 0;
						box-sizing: border-box;
						content: " ";
						width: calc(var(--space-l) * 2);
						height: var(--space-l);
						line-height: 1.5;
						padding-left: var(--space-l);
						border-radius: calc(var(--input-height) / 2);
						background-color: var(--color-secondary);
						color: var(--color-text-inverted);
						border: 1px solid var(--color-border);
						background-image: radial-gradient(
							circle,
							var(--color-input) 35%,
							transparent 36%
						);
						background-position: left calc(-0.5 * var(--space-l)) center;
						background-repeat: no-repeat;
						transition:
							background-color var(--transition-short) var(--easing-inout),
							border-color var(--transition-short) var(--easing-inout),
							background-position var(--transition-short) var(--easing-inout);
					}

					&:hover::before {
						background-color: var(--color-secondary-hover);
					}

					&:active::before {
						background-color: var(--color-secondary-active);
					}
				}

				&.toggle:has(input:checked) label {
					&::before {
						background-color: var(--color-selection-selected);
						border-color: var(--color-selection-active);
						content: "✔︎";
						text-shadow: 0 0 var(--space-xs) var(--color-success-active);
						padding-left: var(--space-s);
						background-position: left calc(0.5 * var(--space-l)) center;
					}

					&:hover::before {
						background-color: var(--color-selection-active);
					}

					&:active::before {
						background-color: var(--color-selection-active);
					}
				}
			}`}</style>
		</form-checkbox>
	)
}
