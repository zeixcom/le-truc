/**
 * TSRX migration: form-radiogroup — a single template-owned component with
 * `options` and `legend` props replacing the hand-written enhancer's
 * variable, author-supplied `<fieldset>`/`<label>`/`<input>` light DOM
 * (LT-0xx). Styling variants (`.radio-group`, `.split-button`) stay
 * author-set `class` attributes on `<form-radiogroup>` — CSS already scopes
 * on them, so no extra prop is needed for that axis.
 *
 * Roving-tabindex keyboard navigation ported from form-radiogroup.ts's
 * `on(host, 'keydown'/'keyup')` handlers as `onKeydown`/`onKeyup` JSX
 * attributes on the root — bare `on(host, …)` setup statements aren't
 * supported by the milestone-2 subset (TSRX005; only const/expose/narrow
 * client-only side effects over host/internals/signals are). Tracking which
 * radio currently has roving focus is read from `document.activeElement`
 * rather than a separate `focusIndex` signal — the original's own click
 * handler existed only to sync a hand-kept index to the DOM's native
 * focus-follows-click behavior, which `document.activeElement` already
 * reflects directly, so no extra state (and no TSRX004 "never rendered"
 * signal) is needed at all.
 */

import { asString } from '@zeix/le-truc'

export const config = { formAssociated: true }

export type FormRadiogroupOption = {
	value: string
	label: string
}

export type FormRadiogroupProps = {
	/** Value of the currently selected radio button. */
	value: string
}

declare global {
	interface HTMLElementTagNameMap {
		'form-radiogroup': FormAssociatedElement & FormRadiogroupProps
	}
}

/**
 * A radio group with roving tabindex keyboard navigation and reactive value tracking.
 * Use it for single-choice selection — provides ARIA radiogroup semantics, Arrow/Home/End
 * key support, and focus management across the radio options. Form participation and
 * validity are via ElementInternals (`formAssociated()`) — set `name` on the host, not
 * the individual radios, which are presentational only.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#form-radiogroup} Interactive preview and usage examples
 **/
export function FormRadiogroup(
	{
		name,
		legend,
		options,
		value = '',
	}:
		{
			name: string
			legend: string
			options: FormRadiogroupOption[]
			value?: string
		},
)
@{
	const ENTER_KEY = 'Enter';
	const DECREMENT_KEYS = ['ArrowLeft', 'ArrowUp'];
	const INCREMENT_KEYS = ['ArrowRight', 'ArrowDown'];
	const FIRST_KEY = 'Home';
	const LAST_KEY = 'End';
	const HANDLED_KEYS = [...DECREMENT_KEYS, ...INCREMENT_KEYS, FIRST_KEY, LAST_KEY];

	expose({
		value: asString(''),
	});

	<>
		<form-radiogroup {name} value={value || options[0]?.value || ''}>
			<fieldset
				onKeydown={(e: KeyboardEvent) => {
					const { key } = e;
					if (!HANDLED_KEYS.includes(key)) return;

					const elements = all('input[type="radio"]', 'add at least one radiobutton').get();
					e.preventDefault();
					e.stopPropagation();
					const current = document.activeElement
						? elements.indexOf(document.activeElement as HTMLInputElement)
						: -1;
					const next =
						key === FIRST_KEY
							? 0
							: key === LAST_KEY
								? elements.length - 1
								: (current +
										(INCREMENT_KEYS.includes(key) ? 1 : -1) +
										elements.length) %
									elements.length;
					elements[next]?.focus();
				}}
				onKeyup={(e: KeyboardEvent) => {
					if (e.key !== ENTER_KEY) return;
					if (document.activeElement instanceof HTMLInputElement)
						document.activeElement.click();
				}}
			>
				<legend>{legend}</legend>
				@for (const option of options; index i) {
					const optValue = option.value;
					<label
						data-value={optValue}
						class={() => (host.value === optValue ? 'selected' : '')}
					>
						<input
							type="radio"
							value={optValue}
							checked={() => host.value === optValue}
							tabindex={() => (host.value === optValue ? 0 : -1)}
							onChange={() => ({ value: optValue })}
						/>
						<span>{option.label}</span>
					</label>
				}
			</fieldset>
		</form-radiogroup>

		<style>
		form-radiogroup {
			display: inline-block;

			> fieldset {
				display: flex;
				gap: var(--space-m);
				border: none;
				margin: 0;
				padding: var(--space-xs) 0 var(--space-s);
			}

			& legend,
			& label {
				font-size: var(--font-size-s);
			}

			& label {
				border-radius: var(--space-xs);

				&:has(:focus-visible) {
					box-shadow: 0 0 var(--space-xxs) 2px var(--color-selection);
				}

				& input:focus {
					outline: none;
					box-shadow: none;
				}
			}

			&.radio-group {
				& label {
					display: flex;
					align-items: center;
					gap: var(--space-xs);
					cursor: pointer;

					&::before {
						content: "";
						flex-shrink: 0;
						display: inline-block;
						box-sizing: border-box;
						width: var(--space-l);
						height: var(--space-l);
						border-radius: 50%;
						border: 1px solid var(--color-border);
						background-color: var(--color-secondary);
						transition:
							background-color var(--transition-short) var(--easing-inout),
							border-color var(--transition-short) var(--easing-inout);
					}

					&:hover::before {
						background-color: var(--color-secondary-hover);
					}

					&:active::before {
						background-color: var(--color-secondary-active);
					}

					&.selected {
						&::before {
							background-color: var(--color-input);
							border-color: var(--color-selection-active);
							background-image: radial-gradient(
								circle,
								var(--color-selection-selected) 48%,
								transparent 50%
							);
							background-size: 100% 100%;
							background-repeat: no-repeat;
						}

						&:hover::before {
							background-image: radial-gradient(
								circle,
								var(--color-selection-active) 48%,
								transparent 50%
							);
						}

						&:active::before {
							background-image: radial-gradient(
								circle,
								var(--color-selection-active) 48%,
								transparent 50%
							);
						}
					}
				}
			}

			&.split-button {
				& fieldset {
					gap: 0;
					padding: 0;
				}

				& label {
					display: inline-block;
					box-sizing: border-box;
					height: var(--input-height);
					min-width: var(--input-height);
					border: 1px solid var(--color-border);
					border-radius: 0;
					border-left-width: 0;
					background-color: var(--color-secondary);
					color: var(--color-text);
					padding: var(--space-xs) var(--space-s);
					cursor: pointer;
					line-height: var(--line-height-s);
					transition: opacity var(--transition-short) var(--easing-inout);

					&:hover {
						background-color: var(--color-secondary-hover);
					}

					&:active {
						background-color: var(--color-secondary-active);
					}

					&:focus-within {
						z-index: 1;
					}

					&.selected {
						color: var(--color-text-inverted);
						background-color: var(--color-selection-selected);
						border-color: var(--color-selection-active);

						&:hover {
							background-color: var(--color-selection-active);
						}

						&:active {
							background-color: var(--color-selection-active);
						}
					}
				}

				& legend + label {
					border-radius: var(--space-xs) 0 0 var(--space-xs);
					border-left-width: 1px;
				}

				& label:last-child {
					border-radius: 0 var(--space-xs) var(--space-xs) 0;
				}
			}
		}
		</style>
	</>
}
