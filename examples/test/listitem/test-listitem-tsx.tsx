/**
 * LT-423 fixture (.tsx surface): the Mount Scope twin of
 * `test-listitem.tsrx` — a store item with a reactive attribute over a
 * store field, a lazy text child, a handler reading the item, a dirty-flag
 * property attribute, and a composed child with `truc:pass={{ get, set }}`,
 * adopted from the server render and then cloned. No key-derived `id`/`for`
 * here: the key binding is `.tsrx` grammar (`key k`) until the `.tsx` keyed
 * `map` lands (LT-425), so the label/input pair loses its association.
 */
import { createList, createStore, type MutableStore } from '@zeix/le-truc'
import { FormCheckbox } from '../../form/checkbox/form-checkbox.tsrx'

export type TestListItemTask = {
	id: string
	label: string
	done: boolean
}

export type TestListitemTsxProps = Record<string, never>

declare global {
	interface HTMLElementTagNameMap {
		'test-listitem-tsx': HTMLElement
	}
}

// biome-ignore lint/correctness/noEmptyPattern: the fixture takes no server args, and the compiler's params contract requires an (empty) destructured object pattern.
export function TestListitemTsx({}: TestListitemTsxProps) {
	const items = createList<TestListItemTask, MutableStore<TestListItemTask>>(
		[
			{ id: 'task-1', label: 'First task', done: true },
			{ id: 'task-2', label: 'Second task', done: false },
		],
		{
			keyConfig: task => task.id,
			createItem: createStore,
		},
	)

	return (
		<test-listitem-tsx>
			<ul class="tasks">
				{
					// @ts-expect-error — `map` on a List is ADR 0046 s4, typed when
					// Cause & Effect 1.6 lands (LT-425); the compiler accepts and
					// lowers the spelling today, and this directive retires then.
					items.map(task => (
						<li class={() => (task.done.get() ? 'done' : null)}>
							<label>{task.label.get()}</label>
							<input
								type="text"
								value={() => task.label.get()}
								onInput={(e: Event) =>
									task.label.set((e.target as HTMLInputElement).value)
								}
							/>
							<FormCheckbox
								name="task"
								label="Done"
								truc:pass={{
									checked: {
										get: () => task.done.get(),
										set: v => task.done.set(Boolean(v)),
									},
								}}
							/>
							<button
								type="button"
								onClick={() => console.log(task.done.get())}
							>
								Log
							</button>
						</li>
					))
				}
			</ul>
			<button
				type="button"
				class="add"
				onClick={() => {
					items.add({
						id: `task-${Date.now()}`,
						label: 'Added task',
						done: true,
					})
				}}
			>
				Add
			</button>
			<style>{css`:host {
				display: block;

				& ul {
					display: flex;
					flex-direction: column;
					gap: var(--space-s);
					list-style: none;
					margin: 0;
					padding: 0;

					& li {
						display: flex;
						align-items: center;
						gap: var(--space-s);
						margin: 0;
						padding: 0;

						&.done {
							color: var(--color-text-soft);
						}
					}
				}
			}`}</style>
		</test-listitem-tsx>
	)
}
