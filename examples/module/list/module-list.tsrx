/**
 * Unified-format spike: module-list — exercises `@for` over a reactive List
 * and component composition (ADR 0023 sub-design 10).
 *
 * - `<FormTextbox ... />` composes `form-textbox.tsrx`: the server splices
 *   its `renderFormTextbox()` output inline instead of hand-duplicating its
 *   markup, and `first('form-textbox')` addresses the rendered custom element for
 *   client-side reads (`textbox.value`, `textbox.clear()`) exactly as a raw
 *   dashed tag would.
 * - `@for (const item of items; key k)` over a declared reactive List →
 *   server renders initial items in place + extracts the item shape into a
 *   `<template>` whose holes become `<slot>` markers; client lowers to
 *   `reconcile()` with a generated `bindItem` that fills the slots.
 * - `truc:pass={{ disabled: () => … }}` on a child custom element → `pass()`
 *   lowering (explicit client-prop attribute, ADR 0023 sub-design 10)
 * - `onClick` inside `@for` → per-item listener in the `bindItem` scope
 *   (ADR 0017 collector parity) — delegation becomes an optimization
 * - ZERO imports: createList auto-imported from '@zeix/le-truc' (v2 bridge)
 */
import { createList } from '@zeix/le-truc'
import { FormTextbox } from '../../form/textbox/form-textbox.tsrx'

export function ModuleList({}: {})
	@{
		const textbox = first('form-textbox', 'the new-item textbox')

		const items = createList<string>([], {
			keyConfig: 'item',
		})

		<module-list>
			<form
				action="#"
				onSubmit={(e: SubmitEvent) => {
					e.preventDefault()
					const value = textbox.value.trim()
					if (!value) return
					items.add(value)
					textbox.clear()
				}}
			>
				<FormTextbox name="new-item" label="New item" clearable />
				<basic-button
					class="submit"
					truc:pass={{ disabled: () => !textbox.length }}
				>
					<button type="submit" class="constructive">Add</button>
				</basic-button>
			</form>
			<ul data-container>
				@for (const item of items; key k) {
					<li>
						<span>{item}</span>
						<basic-button class="remove">
							<button
								type="button"
								class="tertiary destructive small"
								onClick={() => items.remove(k)}
							>
								Remove
							</button>
						</basic-button>
					</li>
				}
			</ul>

			<style>
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--space-l);

				> form {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					gap: var(--space-m);
					justify-content: space-between;
				}

				& ul {
					display: flex;
					flex-direction: column;
					gap: var(--space-m);
					list-style: none;
					margin: 0;
					padding: 0;

					&:empty {
						display: none;
					}

					& li {
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: var(--space-m);
						margin: 0;
						padding: 0;
					}
				}
			}

			@container (width > 27rem) {
				:host {
					& form {
						flex-direction: row;
						align-items: flex-end;
					}
				}
			}</style>
		</module-list>
	}
