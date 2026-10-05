/**
 * LT-429 negative probe (must FAIL tsc — wired through
 * `fixtures/tsx/tsconfig.neg.json`; asserted in
 * server/tests/compiler/tsx/typecheck.test.ts): a `harvest()` entry whose
 * parser yields the wrong type for its field is a tsc error at the entry,
 * on the authored file.
 */
import { asString, createList } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'
import type { DueTask } from '../list-harvest-types'

export function HarvestBadParser({ tasks = [] }: { tasks?: DueTask[] }) {
	const items = createList<DueTask>(
		harvest(tasks, {
			due: asString(),
		}),
		{ keyConfig: task => task.id },
	)
	return (
		<div>
			<ul>
				{items.map(task => (
					<li>{task.get().label}</li>
				))}
			</ul>
		</div>
	)
}
