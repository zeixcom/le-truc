/**
 * Worktree bootstrap — one isolated checkout per queue task.
 *
 *   bun run scripts/worktree.ts <LT-NNN>
 *
 * Ensures .worktrees/<id>/ exists as a git worktree on branch task/<id> cut
 * from the current HEAD, with the main checkout's node_modules symlinked in
 * (fresh worktrees lack it, and a fresh install is minutes; the symlink is
 * never staged). Build outputs are not carried over — a task whose gates need
 * built docs/ runs `bun run --cwd <path> build:docs` first. Idempotent: an
 * existing worktree on the right branch is verified and reused, so a resumed
 * run bootstraps again freely. Prints the worktree facts as JSON.
 *
 * The queue never lives in a worktree: pick/claim/annotate run
 * scripts/queue.ts against the main checkout only, so task branches never
 * touch queue files and merging them back stays clean by construction.
 *
 * Worktrees are created with --no-checkout: the index is populated from HEAD,
 * the agent-config dirs are marked skip-worktree (the primitive sparse
 * checkout itself uses), and only then is the rest materialized. Sandboxed
 * agent hosts — Claude Code among them — refuse writes under their own config
 * dirs, so a plain checkout dies on the first one; none of them is ever a
 * task target, and with the bit set status stays clean and `git add -A`
 * stages no phantom deletions for the absent files. Cleanup after the owner has
 * integrated a branch (—force because of the node_modules symlink):
 *
 *   git worktree remove --force .worktrees/<id> && git branch -d task/<id>
 *
 * Gate invocation inside a worktree is `bun run --cwd <path> <script>` and
 * `bun test --cwd <path> <paths>` — NOT `bun --cwd <path> run <script>`,
 * which bun 1.4.2 silently ignores (usage on stderr, exit 0, nothing runs).
 */
import { spawnSync } from 'node:child_process'
import {
	existsSync,
	lstatSync,
	readlinkSync,
	realpathSync,
	symlinkSync,
} from 'node:fs'
import { join } from 'node:path'

const ROOT = realpathSync(`${import.meta.dir}/..`)

// The explicit function type is load-bearing: TS applies never-returning
// control-flow analysis only to const variables with one, so the guard below
// actually narrows.
const fail: (message: string) => never = message => {
	console.error(message)
	process.exit(1)
}

const git = (args: string[]): string => {
	const run = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
	if (run.status !== 0)
		fail(
			`git ${args.join(' ')} failed (${run.status}): ${(run.stderr || run.stdout).trim()}`,
		)
	return (run.stdout ?? '').trim()
}

const [rawId] = process.argv.slice(2)
if (!rawId || !/^LT-\d+$/.test(rawId)) fail('usage: worktree.ts <LT-NNN>')
const id = rawId

if (!existsSync(join(ROOT, 'node_modules')))
	fail(
		`${join(ROOT, 'node_modules')} not found — install in the main checkout first; the worktree symlinks it`,
	)

const worktreePath = join(ROOT, '.worktrees', id)
const branch = `task/${id}`
let created = false

// Excluded from worktrees: sandboxed hosts block writes under these (their
// own agent config), and no queue task targets them — edits and staging for
// these dirs happen in the main checkout only.
const EXCLUDED_DIRS = ['.agents', '.claude', '.vscode', '.zcode']

if (existsSync(worktreePath)) {
	const head = git(['-C', worktreePath, 'rev-parse', '--abbrev-ref', 'HEAD'])
	if (head !== branch)
		fail(
			`${worktreePath} exists but is on ${head}, not ${branch} — remove it (git worktree remove --force ${worktreePath}) and rerun`,
		)
} else {
	// Reuse a leftover branch only when it sits exactly at HEAD — a branch at
	// any other commit is a stale cut or prior work, and starting from it
	// would base the task on the wrong tree.
	let reuse = false
	const existing = spawnSync('git', ['rev-parse', '--verify', branch], {
		cwd: ROOT,
		encoding: 'utf8',
	})
	if (existing.status === 0) {
		if (existing.stdout.trim() === git(['rev-parse', 'HEAD'])) reuse = true
		else
			fail(
				`branch ${branch} exists at ${existing.stdout.trim().slice(0, 12)}, not HEAD — integrate or delete it first (git branch -D ${branch})`,
			)
	}
	// --no-checkout: git would otherwise materialize every tracked file and
	// die in sandboxed hosts on the first blocked path (e.g.
	// .vscode/settings.json).
	git([
		'worktree',
		'add',
		'--no-checkout',
		worktreePath,
		...(reuse ? [branch] : ['-b', branch, 'HEAD']),
	])
	created = true
	// The index is empty after --no-checkout; populate it from HEAD so the
	// skip-worktree bits have entries to mark.
	git(['-C', worktreePath, 'read-tree', 'HEAD'])
	const excludedPaths = git([
		'-C',
		worktreePath,
		'ls-files',
		'-z',
		'--',
		...EXCLUDED_DIRS,
	])
		.split('\0')
		.filter(Boolean)
	if (excludedPaths.length)
		git([
			'-C',
			worktreePath,
			'update-index',
			'--skip-worktree',
			'--',
			...excludedPaths,
		])
	git(['-C', worktreePath, 'checkout', '--', '.'])
}

const nodeModules = join(worktreePath, 'node_modules')
let linked: string
try {
	const stat = lstatSync(nodeModules)
	linked = stat.isSymbolicLink()
		? readlinkSync(nodeModules)
		: 'own node_modules (not a symlink)'
} catch {
	symlinkSync(join(ROOT, 'node_modules'), nodeModules)
	linked = 'symlinked to main checkout'
}

console.log(
	JSON.stringify({
		created,
		path: worktreePath,
		branch,
		nodeModules: linked,
		...(created ? { excluded: EXCLUDED_DIRS } : {}),
	}),
)
