/**
 * The `.tsx` spelling of `module-todo` (LT-111, ADR 0046) — the last
 * hand-written example, migrated with same-commit cutover. Lives beside the
 * `.tsrx` twin as a variant set (ADR 0039) and is the served surface; the
 * hand-written `.ts` stays as the set's `.ts` twin (ruling 5). Every member
 * declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The reactive list is the keyed `map` over a declared `createList`
 * (ADR 0046 s4): the item is a Mount Scope (s1), a `MutableStore<TodoItem>`
 * whose fields are cells (s3) — read with `.get()` and written with
 * `.set()`. The map body shows the acceptance probes:
 *
 * - per-item `truc:pass` `{ get, set }` into the raw `form-checkbox` and
 *   the composed `FormInplaceEdit` — the item-reading args a compose
 *   cannot take (LTC075) reach the child as mediated passes instead;
 * - key-derived `id`/`for` pairing the checkbox input with its label
 *   (clone-time attributes over the key binding, ADR 0046 s2);
 * - a reactive `disabled` from `items.length` on the reorder handle;
 * - remove through the key: the item's own `onClick` calls
 *   `items.remove(k)`, replacing the twin's host-delegated handler.
 *
 * Drag-and-drop, keyboard reordering and the live region live in ONE
 * shared client-only helper (`examples/_common/reorder.ts`, LT-427) called
 * from setup — the statement stays out of the server module. `nextTodoId()`
 * replaces the twin's module-level `idCounter`.
 */
import {
	bindState,
	createList,
	createMemo,
	createStore,
	type FactoryContext,
	type MutableStore,
} from '@zeix/le-truc'
import { css } from '@zeix/le-truc-compiler/macros'
import {
	nextTodoId,
	setupReorder,
	type TodoItem,
} from '../../_common/reorder.ts'
import { FormInplaceEdit } from '../../form/inplace-edit/form-inplace-edit.tsrx'
import { FormTextbox } from '../../form/textbox/form-textbox.tsrx'

declare global {
	interface HTMLElementTagNameMap {
		'module-todo': HTMLElement
	}
}

export function ModuleTodo(
	// biome-ignore lint/correctness/noEmptyPattern: the component takes no server args, and the compiler's params contract requires an (empty) destructured object pattern.
	{}: {},
	{ host, first, internals, on, watch }: FactoryContext<Record<never, never>>,
) {
	const container = first(
		'[data-container]',
		'Add a container element for items.',
	)
	const liveRegion = first(
		'[role="status"]',
		'Add a live region for status messages.',
	)
	const textbox = first(
		'form-textbox',
		'Add <form-textbox> component to enter a new todo item.',
	)
	const clearCompleted = first(
		'basic-button.clear-completed',
		'Add <basic-button.clear-completed> component to clear completed todo items.',
	)

	const items = createList<TodoItem, MutableStore<TodoItem>>([], {
		keyConfig: item => item.id,
		createItem: createStore,
	})

	const completedCount = createMemo(
		() => items.get().filter(item => item.completed).length,
	)
	const activeCount = createMemo(() => items.length - completedCount.get())

	setupReorder(host, container, items, liveRegion)

	const submitNewTodo = (event: SubmitEvent) => {
		event.preventDefault()
		const label = textbox.value.trim()
		if (!label) return
		items.add({
			id: nextTodoId(),
			label,
			createdAt: new Date(),
			completed: false,
		})
		textbox.clear()
	}

	on(clearCompleted, 'click', () => {
		for (let i = items.length - 1; i >= 0; i--) {
			const key = items.keyAt(i)
			if (key && items.byKey(key)?.completed.get()) items.remove(key)
		}
	})

	const filter = first(
		'form-radiogroup',
		'Add <form-radiogroup> component to filter todo items.',
	)
	watch(
		() => {
			const value = filter.value || 'all'
			return {
				'filter-active': value === 'active',
				'filter-completed': value === 'completed',
			}
		},
		bindState(internals, ['filter-active', 'filter-completed']),
	)

	return (
		<module-todo>
			<form action="#" onSubmit={submitNewTodo}>
				<FormTextbox name="add-todo" label="What needs to be done?" clearable />
				<basic-button
					class="submit"
					truc:pass={{ disabled: () => !textbox.length }}
				>
					<button type="submit" class="constructive" disabled>
						<span class="label">Add Todo</span>
					</button>
				</basic-button>
			</form>
			<span role="status" class="visually-hidden"></span>
			<ol data-container>
				{items.map((item, k) => (
					<li>
						<button
							type="button"
							class="reorder"
							aria-label="Drag to reorder"
							aria-pressed="false"
							disabled={() => items.length === 1}
						>
							≡
						</button>
						<form-checkbox
							class="todo"
							truc:pass={{
								checked: {
									get: () => item.completed.get(),
									set: (v: unknown) => item.completed.set(v as boolean),
								},
							}}
						>
							<input
								type="checkbox"
								id={`${k}-checkbox`}
								class="visually-hidden"
							/>
							<label class="label" for={`${k}-checkbox`}>
								<FormInplaceEdit
									name=""
									truc:pass={{
										value: {
											get: () => item.label.get(),
											set: (v: unknown) => item.label.set(v as string),
										},
									}}
								/>
							</label>
						</form-checkbox>
						<basic-button class="remove">
							<button
								type="button"
								class="tertiary destructive small"
								aria-label="Remove"
								onClick={() => items.remove(k)}
							>
								<span class="label">✕</span>
							</button>
						</basic-button>
					</li>
				))}
			</ol>
			<footer>
				<basic-pluralize truc:pass={{ count: () => activeCount.get() }}>
					<p class="none">Well done, all done!</p>
					<p class="some">
						<span class="count"></span>
						<span class="tasks"></span>
						remaining
					</p>
				</basic-pluralize>
				<form-radiogroup value="all" class="split-button">
					<fieldset>
						<legend class="visually-hidden">Filter</legend>
						<label data-value="all" class="selected">
							<input
								type="radio"
								class="visually-hidden"
								value="all"
								checked
								tabindex={0}
							/>
							<span>All</span>
						</label>
						<label data-value="active">
							<input
								type="radio"
								class="visually-hidden"
								value="active"
								tabindex={-1}
							/>
							<span>Active</span>
						</label>
						<label data-value="completed">
							<input
								type="radio"
								class="visually-hidden"
								value="completed"
								tabindex={-1}
							/>
							<span>Completed</span>
						</label>
					</fieldset>
				</form-radiogroup>
				<basic-button
					class="clear-completed"
					truc:pass={{
						disabled: () => !completedCount.get(),
						badge: () =>
							completedCount.get() ? String(completedCount.get()) : '',
					}}
				>
					<button type="button" class="tertiary destructive">
						<span class="label">Clear Completed</span>
						<span class="badge"></span>
					</button>
				</basic-button>
			</footer>

			<style>{css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--space-l);
				container-type: inline-size;

				&:state(filter-completed) [data-container] li:not(:has(input:checked)) {
					display: none;
				}

				&:state(filter-active) [data-container] li:has(input:checked) {
					display: none;
				}

				> form {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					gap: var(--space-m);
					justify-content: space-between;
				}

				& ol {
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

						&.dragging {
							position: fixed;
							z-index: 100;
							box-sizing: border-box;
							background-color: var(--color-background);
							opacity: var(--opacity-dimmed);
							box-shadow: 0 var(--space-xxs) var(--space-s) var(--color-shadow);
							padding-inline: var(--space-s);

							& button.reorder:not(:disabled) {
								cursor: grabbing;
							}
						}

						&.drop-marker {
							border: 2px dashed var(--color-selection);
							border-radius: var(--space-xs);
							background-color: var(--color-selection-hover);
							padding: 0;
						}
					}
				}

				& button.reorder {
					height: var(--input-height);
					min-inline-size: var(--input-height);
					border-radius: var(--space-xs);
					background: none;
					border: none;
					padding: 0;

					&:disabled {
						opacity: var(--opacity-translucent);
					}

					&:not(:disabled) {
						cursor: grab;
						opacity: var(--opacity-solid);
						color: var(--color-border);

						&:hover {
							background-color: var(--color-overlay-hover);
							color: var(--color-text-soft);
						}

						&:active {
							background-color: var(--color-overlay-active);
							color: var(--color-text-soft);
						}
					}
				}

				> footer {
					display: grid;
					grid-template-columns: 1fr 1fr;
					grid-template-areas: "filter filter" "count clear";
					align-items: center;
					gap: var(--space-m);
					margin: 0;

					& basic-pluralize {
						grid-area: count;
						justify-self: start;
					}

					.split-button {
						grid-area: filter;
						justify-self: center;
					}

					.clear-completed {
						grid-area: clear;
						justify-self: end;
					}
				}
			}

			@container (width > 27rem) {
				:host {
					& form {
						flex-direction: row;
						align-items: flex-end;
					}

					& footer {
						grid-template-columns: 1fr 1fr 1fr;
						grid-template-areas: "count filter clear";
					}
				}
			}

			/* The <p> states are rendered inside the raw <basic-pluralize>, past
			   the scope boundary (ADR 0033 s3): a page-level rule (s6a). */
			:global {
				module-todo basic-pluralize p {
					font-size: var(--font-size-s);
					margin: 0;
				}
			}`}</style>
		</module-todo>
	)
}
