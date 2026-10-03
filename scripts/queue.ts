/**
 * Queue tool — deterministic operations over the le-truc task queue.
 *
 * Subcommands:
 *   check   Validate the queue against the contract (entry format, Area lines,
 *           ID uniqueness, Needs resolution, next-free-ID, chain references).
 *           Exit 1 listing every problem; non-fatal notes are listed too.
 *   pick    Print the do-task pick decision as JSON (read-only; claims nothing).
 *           An optional second argument names a task instead of the chain's
 *           first ready one.
 *   claim   Mark a task — in progress ⚙ (the workflow claims it for a run).
 *   annotate  Write a run's outcome: flip the suffix, insert the handoff prose
 *           after the entry (or a NOTES.md entry when blocked).
 *   reset   Return a claimed task to open (crash recovery).
 *
 * The parsing and the writes live in scripts/lib/queue.ts, under `bun test`;
 * this file is the command-line shell the do-task workflow drives. The queue
 * contract is .agents/skills/architect/references/task-queue.md; this tool
 * never moves entries between queue files, never edits ARCHITECTURE.md and
 * never commits.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	annotateTask,
	claimTask,
	extractCitations,
	loadState,
	type Pick,
	pick,
	pickById,
	type QueueState,
	ROOT,
	resetTask,
} from './lib/queue.ts'
import {
	annotateTaskStore,
	buildViews,
	checkStore,
	claimTaskStore,
	loadStore,
	migrateQueue,
	pickByIdStore,
	pickStore,
	renderEntry,
	resetTaskStore,
	type StorePick,
} from './lib/queue-store.ts'

/** The pick decision's task, as the do-task workflow consumes it. Both queue
 * dialects shape their task into this view: the kanban entry directly, the
 * store task via its rendered entry text. */
interface PickTaskView {
	id: string
	title: string
	area?: string | undefined
	suffix: string
	needs: string[]
	gates: string[]
	text: string
}

const taskInfo = (entry: PickTaskView) => ({
	id: entry.id,
	title: entry.title,
	area: entry.area,
	suffix: entry.suffix,
	rework: entry.suffix === 'changes-requested',
	needs: entry.needs,
	gates: entry.gates,
	citations: extractCitations(entry.text),
	entryText: entry.text,
})

const decision = (state: QueueState, p: Pick): string =>
	JSON.stringify({
		picked: p.picked,
		reason: p.reason,
		...(p.picked && p.task ? { task: taskInfo(p.task) } : {}),
	})

const storeDecision = (p: StorePick): string =>
	JSON.stringify({
		picked: p.picked,
		reason: p.reason,
		...(p.picked && p.task
			? {
					task: taskInfo({
						id: p.task.id,
						title: p.task.title,
						area: p.task.area,
						suffix: p.task.status,
						needs: p.task.needs,
						gates: p.task.gates,
						text: renderEntry(p.task),
					}),
				}
			: {}),
	})

const write = (result: { ok: boolean; error?: string }): number => {
	if (result.ok) return 0
	console.error(result.error)
	return 1
}

const usage = (): number => {
	console.error(
		'usage: queue.ts check | pick [LT-NNN] | claim LT-NNN | annotate LT-NNN <pending-review|done|blocked> <prose-file> | reset LT-NNN | list [--status <status>] | migrate | build [--out <dir>]',
	)
	return 2
}

const [command, ...args] = process.argv.slice(2)

// When the per-task store exists it is the source and the kanban files are
// generated views; every command then works on the store and rebuilds the
// views after each write. Without it the kanban files are the source, exactly
// as before the migration.
const stored = existsSync(join(ROOT, 'queue'))

let exit: number
switch (command) {
	case 'check': {
		const { problems, notes } = stored ? checkStore(ROOT) : loadState(ROOT)
		for (const note of notes) console.log(`note: ${note}`)
		for (const problem of problems) console.error(`problem: ${problem}`)
		exit = problems.length > 0 ? 1 : 0
		break
	}
	case 'pick': {
		const [id] = args
		if (stored) {
			console.log(storeDecision(id ? pickByIdStore(id, ROOT) : pickStore(ROOT)))
		} else {
			const state = loadState(ROOT)
			console.log(decision(state, id ? pickById(id, state) : pick(state)))
		}
		exit = 0
		break
	}
	case 'claim': {
		const [id] = args
		if (!id) {
			exit = usage()
			break
		}
		exit = write(stored ? claimTaskStore(ROOT, id) : claimTask(ROOT, id))
		break
	}
	case 'annotate': {
		const [id, suffix, prosePath] = args
		if (!id || !suffix || !prosePath) {
			exit = usage()
			break
		}
		if (
			suffix !== 'pending-review' &&
			suffix !== 'done' &&
			suffix !== 'blocked'
		) {
			exit = usage()
			break
		}
		const prose = readFileSync(prosePath, 'utf8')
		exit = write(
			stored
				? annotateTaskStore(ROOT, id, suffix, prose)
				: annotateTask(ROOT, id, suffix, prose),
		)
		break
	}
	case 'reset': {
		const [id] = args
		if (!id) {
			exit = usage()
			break
		}
		exit = write(stored ? resetTaskStore(ROOT, id) : resetTask(ROOT, id))
		break
	}
	case 'list': {
		// Read-only discovery for the review pass and other sweeps: the store's
		// tasks as JSON, optionally filtered by status. Refuses an invalid store,
		// exactly like pick.
		if (!stored) {
			console.error('problem: list needs the queue/ store; the kanban files have no list')
			exit = 1
			break
		}
		const [flag, value] = args
		if (flag && flag !== '--status') {
			exit = usage()
			break
		}
		const store = loadStore(ROOT)
		if (store.problems.length) {
			for (const problem of store.problems) console.error(`problem: ${problem}`)
			exit = 1
			break
		}
		const tasks = [...store.tasks.values()]
			.filter(t => !flag || t.status === value)
			.sort((a, b) => (a.id < b.id ? -1 : 1))
			.map(t => ({
				id: t.id,
				title: t.title,
				area: t.area,
				status: t.status,
				note: t.note,
				band: t.band,
				needs: t.needs,
				gates: t.gates,
				entry: renderEntry(t),
			}))
		console.log(JSON.stringify({ tasks }))
		exit = 0
		break
	}
	case 'migrate': {
		if (stored) {
			console.error('problem: queue/ already exists; migrate is one-off')
			exit = 1
			break
		}
		const result = migrateQueue(ROOT)
		for (const problem of result.problems) console.error(`problem: ${problem}`)
		console.log(`migrated ${result.written.length} file(s)`)
		exit = result.problems.length > 0 ? 1 : 0
		break
	}
	case 'build': {
		if (!stored) {
			console.log('no queue/ store; the kanban files are the source')
			exit = 0
			break
		}
		const [flag, outDir] = args
		const result = buildViews(ROOT, flag === '--out' && outDir ? outDir : ROOT)
		if (result.problems.length > 0) {
			for (const problem of result.problems)
				console.error(`problem: ${problem}`)
			exit = 1
			break
		}
		console.log(`built ${result.written.join(', ')}`)
		exit = 0
		break
	}
	default:
		exit = usage()
		break
}

process.exit(exit)
