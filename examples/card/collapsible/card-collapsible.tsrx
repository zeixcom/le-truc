/**
 * Isomorphic-format migration: card-collapsible — a native `<details>`/
 * `<summary>` wrapper whose reactive boolean `open` prop mirrors the
 * descendant `<details>` element's own `open` state (LT-033).
 *
 * Deviation from the hand-written `card-collapsible.ts`: the original
 * harvests `open` once from the pre-existing `<details open>` light-DOM
 * attribute at connect time (light-DOM is the source of truth). TSRX's
 * single canonical template can't harvest from usage-site markup, so `open`
 * becomes a genuine Parser-exposed, attribute-driven prop instead
 * (`asBoolean(false)`) — the JSX reflects it onto `<details open={() =>
 * host.open}>` and a `ref`-based `onToggle` handler keeps it two-way, same
 * end-to-end behavior via a different source of truth.
 */
export type CardCollapsibleProps = {
	/** Whether the card is expanded. Reflects the descendant `<details>` element's `open` state. */
	open: boolean
}

declare global {
	interface HTMLElementTagNameMap {
		'card-collapsible': HTMLElement & CardCollapsibleProps
	}
}

/**
 * A collapsible card wrapping a native `<details>`/`<summary>` element.
 * Use it for any content that should be expandable/collapsible — content-agnostic,
 * the header goes in `<summary>`, the body is the rest of `<details>`'s content.
 * Native disclosure semantics provide keyboard toggling (Enter/Space on the summary)
 * and find-in-page support for free; the `open` reactive property mirrors the
 * descendant `<details>` element's `open` state for programmatic read/control.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#card-collapsible} Interactive preview and usage examples
 **/
export function CardCollapsible({ open = false }: { open?: boolean })
	@{
		expose({ open: asBoolean(false) })

		<>
			<card-collapsible {open}>
				<details ref={details} open={() => host.open} onToggle={() => ({ open: details.open })}>
					<summary>
						<span class="description">
							Click to expand and read the rest of this card — the summary text
							is truncated with an ellipsis while collapsed.
						</span>
					</summary>
					<div class="content">
						<p>
							This is the full body content of the card. It is only visible once
							the card is expanded, and the summary text above wraps normally
							instead of being truncated.
						</p>
					</div>
				</details>
			</card-collapsible>

			<style>
			card-collapsible {
				display: block;
				margin: 0 0 var(--space-l);

				& details {
					border: 1px solid var(--color-border-soft);
					border-radius: var(--space-s);
					overflow: clip;
				}

				& summary {
					display: flex;
					align-items: baseline;
					gap: var(--space-xs);
					padding: var(--space-s) var(--space-m);
					cursor: pointer;
					font-weight: var(--font-weight-bold);
					list-style: none;
					height: auto;

					&::-webkit-details-marker {
						display: none;
					}

					&::before {
						content: "▶";
						flex: none;
						font-size: var(--font-size-s);
						transition: transform var(--transition-short) var(--easing-inout);
					}

					& .description {
						flex: 1 1 auto;
						min-width: 0;
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
						font-weight: var(--font-weight-regular);
						color: var(--color-text-soft);
					}
				}

				& details[open] > summary {
					&::before {
						transform: rotate(90deg);
					}

					& .description {
						overflow: visible;
						text-overflow: unset;
						white-space: normal;
						line-height: var(--line-height-m);
					}
				}

				& .content {
					padding: var(--space-xs) var(--space-m) var(--space-m);

					> *:last-child {
						margin-bottom: 0;
					}
				}
			}
			</style>
		</>
	}
