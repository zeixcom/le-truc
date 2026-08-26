/**
 * Unified-format migration: basic-button — reactive, externally-settable
 * `label` / `badge` / `disabled` props (ADR 0023 examples migration).
 *
 * Deviation from the hand-written `basic-button.ts` (noted per project
 * convention rather than silently dropped): the hand-written version
 * harvests `label`/`badge`/`disabled` once from descendant DOM (span
 * textContent, button.disabled) with graceful fallback when the `.label`
 * span is missing (falls back to the button's own text) or entirely absent
 * (`missing-elements-test` in basic-button.html). TSRX's single canonical
 * template can't represent "sometimes no span at all" — `label`/`badge`
 * become genuine Parser-exposed, attribute-driven, externally-settable
 * props (`asString`/`asBoolean`) instead, mirrored reactively onto the
 * `<span>`s via `{host.label}` — the string-key form `watch('label', …)`
 * already uses for managed form props (`{host.validationMessage}`), just not
 * form-specific: any Parser-exposed prop is `keyof P` for the real
 * `WatchHelper` (`src/helpers/reactive.ts`) — `badge` stays optional via
 * `@if (badge)`.
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
	{ label, badge = '', disabled = false }: { label: string; badge?: string; disabled?: boolean },
)
	@{
		expose({
			disabled: asBoolean(false),
			label: asString(''),
			badge: asString(''),
		})

		<>
			<basic-button {label} {badge} {disabled}>
				<button type="button" disabled={() => host.disabled}>
					<span class="label">{host.label}</span>
					@if (badge) {
						<span class="badge">{host.badge}</span>
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
