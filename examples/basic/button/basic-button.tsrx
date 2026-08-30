/**
 * Children-are-data harvest in the DEFAULT template-owning path
 * (LT-117, reopened): this component OWNS its markup — the server
 * renders the `<button>` and its `span.label`/`span.badge` from
 * the args — and harvests the exposed props back out of that same
 * markup at connect (TSRX-HOST-PROFILE § data account bullet 4).
 * One site per value, three roles: the server's render target, the
 * client's harvest source (ADR 0003, DOM-is-truth), and the
 * client's binding target.
 *
 * The contract this restores, verbatim from the hand-written twin:
 *
 * - `label` harvests `span.label`'s text, falling back to the
 *   button's own text when the page authored no span
 *   (`text-fallback-test` in basic-button.html);
 * - `badge` tolerates absence entirely — `first('span.badge')` is
 *   the OPTIONAL form (LT-123), and the `@if (badge)` branch means
 *   the client already addresses it non-throwing, under a presence
 *   guard;
 * - `label`'s ref is optional for the same reason even though the
 *   template renders the span unconditionally: a page may enhance a
 *   bare `<button>` this component never rendered
 *   (`missing-elements-test`);
 * - `button` is REQUIRED — it is the component's whole reason to
 *   exist, and a missing one throws with the authored reason.
 *
 * `variant`/`size` drive the button's own classes. Per the ownership
 * rule, classes on INNER elements belong to this component and reach
 * it through server args; a parent styling one INSTANCE puts its
 * class on the `basic-button` host instead, where it passes through
 * to the served DOM untouched.
 */

export type BasicButtonProps = {
	/** Whether the button is disabled. */
	disabled: boolean
	/** Visible label text of the button. */
	label: string
	/** Optional badge text displayed alongside the label. */
	badge: string
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-button': HTMLElement & BasicButtonProps
	}
}

/**
 * A button that can be disabled, labelled, and badged via reactive properties.
 * Use it for triggering actions — it provides a native `<button>` with
 * ARIA-friendly labelling and activates on keyboard Space or Enter when focused.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-button} Interactive preview with disabled, labelled, and badged variants
 */
export function BasicButton(
	{
		label,
		badge = '',
		disabled = false,
		variant = 'secondary',
		size = 'medium',
	}: {
		label: string
		badge?: string
		disabled?: boolean
		variant?:
			| 'primary'
			| 'secondary'
			| 'tertiary'
			| 'constructive'
			| 'destructive'
		size?: 'small' | 'medium' | 'large'
	},
)
	@{
		const button = first('button', 'Add a native button as descendant.')
		const labelSpan = first('span.label')
		const badgeSpan = first('span.badge')

		expose({
			disabled: button.disabled,
			label: labelSpan?.textContent ?? button.textContent ?? '',
			badge: badgeSpan?.textContent ?? '',
		})

		<>
			<basic-button>
				<button type="button" class={`${variant} ${size}`} {disabled}>
					<span class="label">{label}</span>
					@if (badge) {
						<span class="badge">{badge}</span>
					}
				</button>
			</basic-button>

			<style>
			basic-button {
				position: relative;
				display: inline-block;
				flex: 0;

				& button {
					height: var(--input-height);
					min-inline-size: var(--input-height);
					border-radius: var(--space-xs);
					background-color: var(--color-secondary);
					border: 1px solid var(--color-border);
					color: var(--color-text);
					padding: 0 var(--space-s);
					font-size: var(--font-size-s);
					line-height: var(--line-height-s);
					white-space: nowrap;
					opacity: var(--opacity-dimmed);
					transition: all var(--transition-shorter) var(--easing-inout);

					&:disabled {
						opacity: var(--opacity-translucent);
					}

					&:not(:disabled) {
						cursor: pointer;
						opacity: var(--opacity-solid);

						&:hover {
							background-color: var(--color-secondary-hover);
						}

						&:active {
							background-color: var(--color-secondary-active);
						}
					}

					/* Variants — chosen with the `variant` arg. */
					&.primary {
						background-color: var(--color-primary);
						border-color: var(--color-primary);
						color: var(--color-primary-text);

						&:not(:disabled) {
							&:hover {
								background-color: var(--color-primary-hover);
							}

							&:active {
								background-color: var(--color-primary-active);
							}
						}
					}

					&.tertiary {
						background-color: transparent;
						border-color: transparent;

						&:not(:disabled) {
							&:hover {
								background-color: var(--color-secondary-hover);
							}

							&:active {
								background-color: var(--color-secondary-active);
							}
						}
					}

					&.constructive {
						background-color: var(--color-success);
						border-color: var(--color-success);
						color: var(--color-success-text);

						&:not(:disabled) {
							&:hover {
								background-color: var(--color-success-hover);
							}

							&:active {
								background-color: var(--color-success-active);
							}
						}
					}

					&.destructive {
						background-color: var(--color-error);
						border-color: var(--color-error);
						color: var(--color-error-text);

						&:not(:disabled) {
							&:hover {
								background-color: var(--color-error-hover);
							}

							&:active {
								background-color: var(--color-error-active);
							}
						}
					}

					/* Sizes — chosen with the `size` arg. */
					&.small {
						height: var(--space-l);
						min-inline-size: var(--space-l);
						padding: 0 var(--space-xs);
						font-size: var(--font-size-xs);
						line-height: var(--line-height-xs);
					}

					&.large {
						height: var(--space-xl);
						min-inline-size: var(--space-xl);
						padding: 0 var(--space-m);
						font-size: var(--font-size-m);
						line-height: var(--line-height-m);
					}
				}

				.badge {
					position: absolute;
					box-sizing: border-box;
					top: calc(-1 * var(--space-s));
					right: calc(-1 * var(--space-s));
					font-size: var(--font-size-xs);
					line-height: var(--line-height-xs);
					background-color: var(--color-primary);
					color: var(--color-text-inverted);
					padding: var(--space-xxs) var(--space-xs);
					height: calc(2 * var(--space-s));
					min-width: calc(2 * var(--space-s));
					border-radius: var(--space-s);

					&:empty {
						display: none;
					}
				}
			}
			</style>
		</>
	}
