/**
 * LT-429 probe (must compile clean): `harvest()` on the authored surface.
 * Each entry is typed as a `Parser` of its field, so a complete map for an
 * imported item type — a `Date` field through an authored parser included —
 * checks against the item type with no compiler in between. The negative
 * twin is `harvest-bad-parser.tsx`.
 */
import { asParser, asString, createList } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'
import type { DueTask } from '../list-harvest-types'

export function HarvestList({ tasks = [] }: { tasks?: DueTask[] }) {
	const items = createList<DueTask>(
		harvest(tasks, {
			id: asString(),
			label: asString(),
			due: asParser(v => new Date(v ?? '')),
		}),
		{ keyConfig: task => task.id },
	)
	return (
		<div>
			<ul>
				{items.map(task => (
					<li>
						<time datetime={() => String(task.get().due)}>
							{task.get().label}
						</time>
					</li>
				))}
			</ul>
		</div>
	)
}
