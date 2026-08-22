/**
 * Unified-format spike: module-list — exercises `@for` over a reactive List.
 *
 * - `@for (const item of items; key k)` over a declared reactive List →
 *   server renders initial items in place + extracts the item shape into a
 *   `<template>` whose holes become `<slot>` markers; client lowers to
 *   `reconcile()` with a generated `bindItem` that fills the slots.
 * - `disabled={() => …}` on a child custom element → `pass()` lowering
 *   (function-valued attribute = reactive binding; child is in the registry)
 * - `ref={textbox}` → generated `first()` query (element addressing)
 * - `onClick` inside `@for` → per-item listener in the `bindItem` scope
 *   (ADR 0017 collector parity) — delegation becomes an optimization
 * - ZERO imports: createList auto-imported from '@zeix/le-truc' (v2 bridge)
 */
export function ModuleList({}: {})
	@{
		const items = createList<string>([], {
			keyConfig: 'item',
		})

		<>
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
					<form-textbox clearable ref={textbox}>
						<label for="new-item-input">New item</label>
						<div class="input">
							<input
								type="text"
								id="new-item-input"
								name="new-item"
								autocomplete="off"
							/>
							<button
								type="button"
								class="clear"
								aria-label="Clear input"
								hidden
							>
								✕
							</button>
						</div>
					</form-textbox>
					<basic-button class="submit" disabled={() => !textbox.length}>
						<button type="submit" class="constructive">Add</button>
					</basic-button>
				</form>
				<ul data-container>
					@for (const item of items; key k) {
						<li>
							<span>&{item}</span>
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
			</module-list>

			<style>
			module-list {
				display: flex;
				flex-direction: column;
				gap: var(--space-s);

				> form {
					display: flex;
					gap: var(--space-s);
					align-items: flex-start;
				}

				> [data-container] {
					display: flex;
					flex-direction: column;
					gap: var(--space-xs);
					margin: 0;
					padding: 0;
					list-style: none;

					> li {
						display: flex;
						justify-content: space-between;
						align-items: center;
						gap: var(--space-s);
					}
				}
			}
			</style>
		</>
	}
