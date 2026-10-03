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
	type QueueEntry,
	type QueueState,
	ROOT,
	resetTask,
} from './lib/queue.ts'
import { checkStore } from './lib/queue-store.ts'

/** The pick decision's task, as the do-task workflow consumes it. */
const taskInfo = (entry: QueueEntry) => ({
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

const write = (result: { ok: boolean; error?: string }): number => {
	if (result.ok) return 0
	console.error(result.error)
	return 1
}

const usage = (): number => {
	console.error(
		'usage: queue.ts check | pick [LT-NNN] | claim LT-NNN | annotate LT-NNN <pending-review|done|blocked> <prose-file> | reset LT-NNN | migrate | build [--out <dir>]',
	)
	return 2
}

const [command, ...args] = process.argv.slice(2)

let exit: number
switch (command) {
	case 'check': {
		// When the per-task store exists it is the source and the kanban files
		// are generated views; check validates the store and view freshness.
		const stored = existsSync(join(ROOT, 'queue'))
		const { problems, notes } = stored ? checkStore(ROOT) : loadState(ROOT)
		for (const note of notes) console.log(`note: ${note}`)
		for (const problem of problems) console.error(`problem: ${problem}`)
		exit = problems.length > 0 ? 1 : 0
		break
	}
	case 'pick': {
		const state = loadState(ROOT)
		const [id] = args
		console.log(decision(state, id ? pickById(id, state) : pick(state)))
		exit = 0
		break
	}
	case 'claim': {
		const [id] = args
		exit = id ? write(claimTask(ROOT, id)) : usage()
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
		exit = write(
			annotateTask(ROOT, id, suffix, readFileSync(prosePath, 'utf8')),
		)
		break
	}
	case 'reset': {
		const [id] = args
		exit = id ? write(resetTask(ROOT, id)) : usage()
		break
	}
	case 'migrate': {
		const { migrateQueue } = await import('./lib/queue-store.ts')
		const result = migrateQueue(ROOT)
		for (const problem of result.problems) console.error(`problem: ${problem}`)
		console.log(`migrated ${result.written.length} file(s)`)
		exit = result.problems.length > 0 ? 1 : 0
		break
	}
	case 'build': {
		const { buildViews } = await import('./lib/queue-store.ts')
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
