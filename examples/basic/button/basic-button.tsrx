/**
 * Children-are-data harvest in the DEFAULT template-owning path
 * (LT-117, reopened): this component OWNS its markup — the server
 * renders the `<button>` and its `span.label`/`span.badge` from
 * the args — and harvests the exposed props back out of that same
 * markup at connect (HOST_PROFILE § data account bullet 4).
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
 *   the OPTIONAL form (LT-123). The template renders the span
 *   unconditionally, empty when there is no badge (`.badge:empty`
 *   hides it), so a parent that drives `badge` by `truc:pass` has a
 *   site to land on (LT-321); the ref stays optional because a page
 *   may author a button with no badge span at all;
 * - `label`'s ref is optional for the same reason even though the
 *   template renders the span unconditionally: a page may enhance a
 *   bare `<button>` this component never rendered
 *   (`missing-elements-test`);
 * - `button` is REQUIRED — it is the component's whole reason to
 *   exist, and a missing one throws with the authored reason.
 *
 * `onClick` is a handler arg (LT-461): placed on the native button, it
 * renders nothing here — a composing parent's `onClick` lowers to an
 * `on()` against `basic-button button` in the parent's own client. A
 * page-authored instance carries no handler.
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
		type = 'button',
		ariaLabel,
		onClick,
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
		/** The native button's `type`. */
		type?: 'button' | 'submit'
		/** Accessible name, for a button whose label is a symbol. */
		ariaLabel?: string
		/** Click handler, bound by the composing parent on the native button. */
		onClick?: (e: MouseEvent) => void
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

		<basic-button>
			<button
				{type}
				class={`${variant} ${size}`}
				{disabled}
				aria-label={ariaLabel}
				{onClick}
			>
				<span class="label">{label}</span>
				<span class="badge">{badge}</span>
			</button>

			<style>
			@scope {
				:scope {
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

						&.primary {
							color: var(--color-primary-text);
							background-color: var(--color-primary);
							border-color: var(--color-primary-active);

							&:not(:disabled) {
								opacity: var(--opacity-solid);

								&:hover {
									background-color: var(--color-primary-hover);
								}

								&:active {
									background-color: var(--color-primary-active);
								}
							}
						}

						&.destructive {
							color: var(--color-error-text);
							background-color: var(--color-error);
							border-color: var(--color-error-active);

							&:not(:disabled) {
								opacity: var(--opacity-solid);

								&:hover {
									background-color: var(--color-error-hover);
								}

								&:active {
									background-color: var(--color-error-active);
								}
							}
						}

						&.constructive {
							color: var(--color-success-text);
							background-color: var(--color-success);
							border-color: var(--color-success-active);

							&:not(:disabled) {
								opacity: var(--opacity-solid);

								&:hover {
									background-color: var(--color-success-hover);
								}

								&:active {
									background-color: var(--color-success-active);
								}
							}
						}

						&.tertiary {
							background: transparent;
							border: none;
							padding: var(--space-xs);
							height: auto;
							color: var(--color-primary);

							&:not(:disabled) {
								opacity: var(--opacity-solid);

								&:hover {
									background-color: var(--color-overlay-hover);
									color: var(--color-primary-hover);
								}

								&:active {
									background-color: var(--color-overlay-active);
									color: var(--color-primary-active);
								}
							}

							&.constructive {
								color: var(--color-success);

								&:not(:disabled) {
									opacity: var(--opacity-solid);

									&:hover {
										color: var(--color-success-hover);
									}

									&:active {
										color: var(--color-success-active);
									}
								}
							}

							&.destructive {
								color: var(--color-error);

								&:not(:disabled) {
									opacity: var(--opacity-solid);

									&:hover {
										color: var(--color-error-hover);
									}

									&:active {
										color: var(--color-error-active);
									}
								}
							}
						}

						&.small {
							--input-height: var(--space-l);
							font-size: var(--font-size-xs);
							padding-inline: var(--space-xs);
						}

						&.large {
							--input-height: var(--space-xl);
							font-size: var(--font-size-m);
							padding-inline: var(--space-m);
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
			}</style>
		</basic-button>
	}
