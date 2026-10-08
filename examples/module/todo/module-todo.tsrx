/**
 * The `.tsrx` spelling of `module-todo` (LT-111, ADR 0046) — the variant
 * twin of the served `module-todo.tsx` (ADR 0039); the hand-written `.ts`
 * stays as the set's `.ts` twin (ruling 5). Every member declares its own
 * `HTMLElementTagNameMap` entry (s4).
 *
 * The reactive list is `@for (const item of items; key k)` over a declared
 * `createList` (ADR 0046 s4): the item is a Mount Scope (s1), a
 * `MutableStore<TodoItem>` whose fields are cells (s3) — read with `.get()`
 * and written with `.set()`. The loop body shows the acceptance probes:
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
 *
 * The submit button is a composed `BasicButton` (LT-463) with the existing
 * `disabled` pass and `t.addTodo` as the label arg. The remove and
 * clear-completed buttons and the filter radiogroup stay raw: the
 * `tertiary destructive` modifier combos have no prop shape yet (LT-489)
 * and the composed radiogroup render cannot carry the page-level
 * `visually-hidden` presentation on its legend and radios.
 */
import {
	bindState,
	createList,
	createMemo,
	createStore,
	type MutableStore,
} from '@zeix/le-truc'
import { nextTodoId, setupReorder, type TodoItem } from '../../_common/reorder.ts'
import { BasicButton } from '../../basic/button/basic-button.tsrx'
import { FormInplaceEdit } from '../../form/inplace-edit/form-inplace-edit.tsrx'
import { FormTextbox } from '../../form/textbox/form-textbox.tsrx'

declare global {
	interface HTMLElementTagNameMap {
		'module-todo': HTMLElement
	}
}

// The remaining-count line is the component's own ICU message (LT-467): the
// `=0` arm replaces the former none/some toggle — no markup varies, so no arm
// set. `activeCount` is client-reactive, so the pattern's parsed AST rides
// the root `i18n` attribute off the source locale and the client re-evaluates
// it on change (ADR 0030 s9). Declaring the record makes every other template
// label a key too (LTC047); those fold server-side.
export const i18n = {
	addTodo: 'Add Todo',
	filter: 'Filter',
	all: 'All',
	active: 'Active',
	completed: 'Completed',
	clearCompleted: 'Clear Completed',
	remaining:
		'{count, plural, =0 {Well done, all done!} one {# task remaining} other {# tasks remaining}}',
} as const

export function ModuleTodo({ i18n: { t } }: { i18n: I18n<typeof i18n> })
	@{
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

		<module-todo>
			<form action="#" onSubmit={submitNewTodo}>
				<FormTextbox name="add-todo" label="What needs to be done?" clearable />
				<BasicButton
					class="submit"
					type="submit"
					variant="constructive"
					disabled
					label={t.addTodo}
					truc:pass={{ disabled: () => !textbox.length }}
				/>
			</form>
			<span role="status" class="visually-hidden"></span>
			<ol data-container>
				@for (const item of items; key k) {
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
								{/* Interactive content inside a label is invalid HTML and
								    leaks activation (LT-466): the editor lives beside the
								    checkbox; the label keeps only a visually-hidden text
								    bound to the item label, so the accessible name of the
								    box follows edits while the visible text is the
								    editor's. The label itself stays visible — its ::before
								    draws the checkbox box (form-checkbox.css). */}
								<span class="visually-hidden">{() => item.label.get()}</span>
							</label>
						</form-checkbox>
						<FormInplaceEdit
							name=""
							truc:pass={{
								value: {
									get: () => item.label.get(),
									set: (v: unknown) => item.label.set(v as string),
								},
							}}
						/>
						{/* Raw, not composed (LT-463): the `tertiary destructive small`
						    class triple is not expressible through BasicButton's props —
						    the modifier shape is ruled in LT-489. */}
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
				}
			</ol>
			<footer>
				<p class="remaining">{() => t.remaining({ count: activeCount.get() })}</p>
				{/* Raw, not composed (LT-463): the composed render cannot carry the
				    page-level `visually-hidden` presentation on the legend and the
				    radios — a child-contract decision, not a compose arg. */}
				<form-radiogroup value="all" class="split-button">
					<fieldset>
						<legend class="visually-hidden">{t.filter}</legend>
						<label data-value="all" class="selected">
							<input
								type="radio"
								class="visually-hidden"
								value="all"
								checked
								tabindex="0"
							/>
							<span>{t.all}</span>
						</label>
						<label data-value="active">
							<input
								type="radio"
								class="visually-hidden"
								value="active"
								tabindex="-1"
							/>
							<span>{t.active}</span>
						</label>
						<label data-value="completed">
							<input
								type="radio"
								class="visually-hidden"
								value="completed"
								tabindex="-1"
							/>
							<span>{t.completed}</span>
						</label>
					</fieldset>
				</form-radiogroup>
				{/* Raw, not composed (LT-463): the `tertiary destructive` class pair
				    is not expressible through BasicButton's props — the modifier
				    shape is ruled in LT-489. */}
				<basic-button
					class="clear-completed"
					truc:pass={{
						disabled: () => !completedCount.get(),
						badge: () => (completedCount.get() ? String(completedCount.get()) : ''),
					}}
				>
					<button type="button" class="tertiary destructive">
						<span class="label">{t.clearCompleted}</span>
						<span class="badge"></span>
					</button>
				</basic-button>
			</footer>

			<style>
			@scope to (basic-button > *) {
				:where(:scope) {
					display: flex;
					flex-direction: column;
					gap: var(--space-l);
					container-type: inline-size;
				}

				:where(:scope):state(filter-completed) [data-container] li:not(:has(input:checked)) {
					display: none;
				}

				:where(:scope):state(filter-active) [data-container] li:has(input:checked) {
					display: none;
				}

				form {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					gap: var(--space-m);
					justify-content: space-between;
				}

				ol {
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

						/* LT-466: the editor sits beside the checkbox, not inside
						   its label — the checkbox's own flex-grow cedes the free
						   space to the editor, and a completed item keeps the text
						   treatment its label used to carry. */
						& > form-checkbox {
							flex-grow: 0;
						}

						& > form-inplace-edit {
							flex: 1;
							min-width: 0;
						}

						&:has(input:checked) > form-inplace-edit {
							opacity: var(--opacity-translucent);
							text-decoration: line-through;
						}

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

				button.reorder {
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

				footer {
					display: grid;
					grid-template-columns: 1fr 1fr;
					grid-template-areas: "filter filter" "count clear";
					align-items: center;
					gap: var(--space-m);
					margin: 0;

					& .remaining {
						grid-area: count;
						justify-self: start;
						font-size: var(--font-size-s);
						margin: 0;
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

				@container (width > 27rem) {
					form {
						flex-direction: row;
						align-items: flex-end;
					}

					footer {
						grid-template-columns: 1fr 1fr 1fr;
						grid-template-areas: "count filter clear";
					}
				}
			}</style>
		</module-todo>
	}
