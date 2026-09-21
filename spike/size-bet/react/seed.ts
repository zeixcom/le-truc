/**
 * The representative initial state for the size-bet scenario (LT-266): a
 * todo list hydrated from server data. Five items, mixed completion — large
 * enough that the React side's JSON payload is a real cost, small enough to
 * read at a glance. Both framework variants instantiate the component with
 * exactly this state; the difference is the channel: Le Truc serves it as
 * the DOM and harvests at connect (ADR 0003: no state crosses the
 * server→client boundary), React serves the same DOM plus this payload as
 * JSON for hydration.
 */
import type { TodoItem } from './module-todo'

export const SEED_TODOS: TodoItem[] = [
	{
		id: 'todo1',
		label: 'Read the size-bet finding',
		createdAt: '2026-09-21T08:00:00.000Z',
		completed: true,
	},
	{
		id: 'todo2',
		label: 'Water the office plant',
		createdAt: '2026-09-21T08:05:00.000Z',
		completed: false,
	},
	{
		id: 'todo3',
		label: 'Book the team offsite venue',
		createdAt: '2026-09-21T08:10:00.000Z',
		completed: false,
	},
	{
		id: 'todo4',
		label: 'Reply to the connector draft',
		createdAt: '2026-09-21T08:15:00.000Z',
		completed: false,
	},
	{
		id: 'todo5',
		label: 'Archive last sprint\'s notes',
		createdAt: '2026-09-21T08:20:00.000Z',
		completed: true,
	},
]
