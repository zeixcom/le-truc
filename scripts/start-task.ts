/**
 * Start a queue task — pick, claim and worktree bootstrap in one step.
 *
 *   bun run scripts/start-task.ts [LT-NNN]
 *
 * Runs `scripts/queue.ts pick [LT-NNN]`, then `scripts/queue.ts claim <id>`,
 * then `scripts/worktree.ts <id>`, all against the main checkout, and prints
 * one JSON object: the pick decision (task id, title, area, rework, needs,
 * gates, citations, entry text) plus the worktree facts. A failed bootstrap
 * resets the claim, so a refused start leaves the queue as it found it.
 *
 * Exit 0 means the task is claimed and its worktree is ready. Exit 1 means
 * nothing was started: nothing is ready (the JSON's `reason` says why), the
 * claim was refused, or the bootstrap failed. The queue contract stays in
 * scripts/queue.ts and the worktree rules in scripts/worktree.ts; this file
 * only sequences them for the contributor skill.
 */
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'

const ROOT = realpathSync(`${import.meta.dir}/..`)

const run = (script: string, args: string[]) => {
	const result = spawnSync(process.execPath, ['run', script, ...args], {
		cwd: ROOT,
		encoding: 'utf8',
	})
	return {
		ok: result.status === 0,
		stdout: (result.stdout ?? '').trim(),
		stderr: (result.stderr ?? '').trim(),
	}
}

const stop = (report: Record<string, unknown>): never => {
	console.log(JSON.stringify({ started: false, ...report }))
	process.exit(1)
}

const [id] = process.argv.slice(2)
if (id && !/^LT-\d+$/.test(id)) {
	console.error('usage: start-task.ts [LT-NNN]')
	process.exit(2)
}

const pick = run('scripts/queue.ts', ['pick', ...(id ? [id] : [])])
if (!pick.ok)
	stop({ reason: `queue pick failed: ${pick.stderr || pick.stdout}` })
const decision = JSON.parse(pick.stdout) as {
	picked: boolean
	reason: string
	task?: { id: string } & Record<string, unknown>
}
if (!decision.picked || !decision.task) stop({ reason: decision.reason })
const task = decision.task as { id: string } & Record<string, unknown>

const claim = run('scripts/queue.ts', ['claim', task.id])
if (!claim.ok) stop({ id: task.id, reason: `claim refused: ${claim.stderr}` })

const bootstrap = run('scripts/worktree.ts', [task.id])
if (!bootstrap.ok) {
	const reset = run('scripts/queue.ts', ['reset', task.id])
	stop({
		id: task.id,
		reason: `worktree bootstrap failed: ${bootstrap.stderr}`,
		claimReset: reset.ok,
	})
}
// worktree.ts prints its facts as the last stdout line; notes go to stderr.
const worktree = JSON.parse(bootstrap.stdout.split('\n').at(-1) ?? '{}')

console.log(
	JSON.stringify({
		started: true,
		reason: decision.reason,
		task,
		worktree,
		...(bootstrap.stderr ? { notes: bootstrap.stderr.split('\n') } : {}),
	}),
)
