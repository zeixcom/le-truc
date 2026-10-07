/**
 * LT-423 fixture (.tsrx surface): a reactive-list item is a Mount Scope
 * (ADR 0046 s1). The item is a STORE item (`createItem: createStore`), and
 * the body carries everything the mount scope lowered — one level:
 *
 * - a reactive attribute over a store field (`class` from `task.done`),
 * - a dirty-flag property attribute over a store field (`value`),
 * - a lazy text child over a store field (`{task.label.get()}`),
 * - a handler reading the item (the retired `listItemHandlerFix` refusal),
 * - key-derived `id`/`for` over the key binding (set once at clone),
 * - `truc:pass={{ checked: { get, set } }}` into a composed child, whose
 *   server markup is baked into the extracted `<template>`.
 * - a handler arg on a composed child (LT-461): `<BasicButton onClick>`
 *   lowers to an `on()` on the child's native button in the item's mount,
 *   reading the key — the remove button.
 *
 * The page serves two server-rendered tasks (adopted at connect, wiring
 * applied in place) and the Add button exercises the clone path. The `.tsx`
 * twin (`test-listitem-tsx.tsx`) carries the same item content over the
 * keyed `map` (LT-425), its button logging instead of removing.
 */
import { createList, createStore, type MutableStore } from '@zeix/le-truc'
import { BasicButton } from '../../basic/button/basic-button.tsrx'
import { FormCheckbox } from '../../form/checkbox/form-checkbox.tsrx'

export type TestListItemTask = {
	id: string
	label: string
	done: boolean
}

export function TestListitem({}: {})
	@{
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

		<test-listitem>
			<ul class="tasks">
				@for (const task of items; key k) {
					<li class={() => (task.done.get() ? 'done' : null)}>
						<label for={k}>{task.label.get()}</label>
						<input
							type="text"
							id={k}
							value={() => task.label.get()}
							onInput={(e: InputEvent) =>
								task.label.set((e.target as HTMLInputElement).value)
							}
						/>
						<FormCheckbox
							name="task"
							label="Done"
							truc:pass={{
								checked: {
									get: () => task.done.get(),
									set: (v: boolean) => task.done.set(v),
								},
							}}
						/>
						<BasicButton label="Remove" onClick={() => items.remove(k)} />
					</li>
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

			<style>
			@scope to (form-checkbox > *, basic-button > *) {
				:scope {
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
				}
			}</style>
		</test-listitem>
	}
