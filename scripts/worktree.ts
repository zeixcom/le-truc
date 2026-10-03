/**
 * Worktree bootstrap and integration — one isolated checkout per queue task.
 *
 *   bun run scripts/worktree.ts <LT-NNN>
 *   bun run scripts/worktree.ts commit <LT-NNN> --message-file <path> [--] <path>...
 *   bun run scripts/worktree.ts integrate <LT-NNN>
 *
 * Bootstrap ensures .worktrees/<id>/ exists as a git worktree on branch
 * task/<id> cut from the current HEAD, with the main checkout's node_modules
 * symlinked in (fresh worktrees lack it, and a fresh install is minutes; the
 * symlink is never staged). Build outputs are not carried over — a task whose
 * gates need built docs/ runs `bun run --cwd <path> build:docs` first.
 * Idempotent: an existing worktree on the right branch is verified and reused,
 * so a resumed run bootstraps again freely; a branch that already carries
 * commits beyond HEAD is reused too, because that is a task's rework
 * continuing, not a stale cut. Prints the worktree facts as JSON.
 *
 * Commits made inside a worktree are unsigned: the bootstrap sets
 * commit.gpgsign=false worktree-locally (extensions.worktreeConfig; owner
 * ruling 2026-10-03). Task branches are local-only and the integration merge
 * in the main checkout stays signed.
 *
 * `commit` is how a run lands its work (owner ruling 2026-10-03): it stages
 * exactly the given paths — the run's Changed list, so gate-run churn never
 * rides — and commits them with the message file. Anything else left in the
 * worktree is reported as residue, never staged; `integrate` refuses a dirty
 * worktree, so residue is a decision, not a default. Protected paths (the
 * queue store and views, NOTES.md, the agent-config dirs) are refused even
 * when a handoff wrongly lists them: a task branch never carries them, which
 * is what keeps merging back clean.
 *
 * `integrate` merges task/<id> --no-ff into the main checkout's current
 * branch — signed, since the review pass is owner-attended — after checking
 * the worktree is clean and the task is in a mergeable state, then removes
 * the worktree and deletes the branch. A conflict fails loudly with the
 * abort hint; resolving it is a design call, not a script default.
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
 * task target, and edits and staging of them happen in the main checkout only.
 *
 * Gate invocation inside a worktree is `bun run --cwd <path> <script>` and
 * `bun test --cwd <path> <paths>` — NOT `bun --cwd <path> run <script>`,
 * which bun 1.4.2 silently ignores (usage on stderr, exit 0, nothing runs).
 */
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadStore } from './lib/queue-store.ts'

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

// Excluded from worktrees, and refused by `commit`: sandboxed hosts block
// writes under the agent-config dirs (their own config), and the queue store,
// its generated views and NOTES.md are main-checkout-only — a task branch
// never carries them, which is what keeps merging back clean.
const EXCLUDED_DIRS = ['.agents', '.claude', '.vscode', '.zcode']
const PROTECTED_PATHS = ['BACKLOG.md', 'TODO.md', 'DONE.md', 'NOTES.md', 'queue/', ...EXCLUDED_DIRS.map(d => `${d}/`)]

const worktreePath = (id: string) => join(ROOT, '.worktrees', id)
const branchOf = (id: string) => `task/${id}`

// Signing is configured worktree-locally so a human or a tool committing in
// the worktree cannot silently depend on the owner's agent key being present.
function ensureUnsigned(worktreePath: string): void {
	git(['config', 'extensions.worktreeConfig', 'true'])
	git(['-C', worktreePath, 'config', '--worktree', 'commit.gpgsign', 'false'])
}

function linkNodeModules(worktreePath: string): string {
	const nodeModules = join(worktreePath, 'node_modules')
	try {
		const stat = lstatSync(nodeModules)
		return stat.isSymbolicLink() ? readlinkSync(nodeModules) : 'own node_modules (not a symlink)'
	} catch {
		symlinkSync(join(ROOT, 'node_modules'), nodeModules)
		return 'symlinked to main checkout'
	}
}

// Bootstraps .worktrees/<id>; prints the worktree facts as JSON.
function bootstrap(id: string): never {
	if (!existsSync(join(ROOT, 'node_modules')))
		fail(
			`${join(ROOT, 'node_modules')} not found — install in the main checkout first; the worktree symlinks it`,
		)

	const wtPath = worktreePath(id)
	const branch = branchOf(id)
	let created = false
	let continued = false

	if (existsSync(wtPath)) {
		const head = git(['-C', wtPath, 'rev-parse', '--abbrev-ref', 'HEAD'])
		if (head !== branch)
			fail(
				`${wtPath} exists but is on ${head}, not ${branch} — remove it (git worktree remove --force ${wtPath}) and rerun`,
			)
		continued = Number(git(['rev-list', '--count', `HEAD..${branch}`])) > 0
	} else {
		// Reuse a leftover branch when it sits exactly at HEAD (an idempotent
		// re-bootstrap) or already carries commits beyond HEAD (the task's own
		// rework — continue it). A branch anywhere else is a stale cut, and
		// starting from it would base the task on the wrong tree.
		let reuse = false
		const existing = spawnSync('git', ['rev-parse', '--verify', branch], {
			cwd: ROOT,
			encoding: 'utf8',
		})
		if (existing.status === 0) {
			const tip = existing.stdout.trim()
			if (tip === git(['rev-parse', 'HEAD'])) reuse = true
			else if (Number(git(['rev-list', '--count', `HEAD..${branch}`])) > 0) {
				reuse = true
				continued = true
			} else
				fail(
					`branch ${branch} exists at ${tip.slice(0, 12)} with no commits beyond HEAD — integrate or delete it first (git branch -D ${branch})`,
				)
		}
		// --no-checkout: git would otherwise materialize every tracked file and
		// die in sandboxed hosts on the first blocked path (e.g.
		// .vscode/settings.json).
		git([
			'worktree',
			'add',
			'--no-checkout',
			wtPath,
			...(reuse ? [branch] : ['-b', branch, 'HEAD']),
		])
		created = true
		// The index is empty after --no-checkout; populate it from HEAD so the
		// skip-worktree bits have entries to mark.
		git(['-C', wtPath, 'read-tree', 'HEAD'])
		const excludedPaths = git([
			'-C',
			wtPath,
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
				wtPath,
				'update-index',
				'--skip-worktree',
				'--',
				...excludedPaths,
			])
		git(['-C', wtPath, 'checkout', '--', '.'])
	}

	ensureUnsigned(wtPath)
	const nodeModules = linkNodeModules(wtPath)

	console.log(
		JSON.stringify({
			created,
			continued,
			path: wtPath,
			branch,
			nodeModules: nodeModules,
			signing: 'unsigned (worktree-local commit.gpgsign=false)',
			...(created ? { excluded: EXCLUDED_DIRS } : {}),
		}),
	)
	process.exit(0)
}

// Commits exactly the given paths on the task branch, unsigned; prints the
// commit and any residue as JSON. Exit 0 with residue is still a success —
// `integrate` is the step that refuses a dirty worktree.
function commit(id: string, args: string[]): never {
	const wtPath = worktreePath(id)
	const branch = branchOf(id)
	if (!existsSync(wtPath))
		fail(`no worktree at ${wtPath} — bootstrap ${id} first`)
	const head = git(['-C', wtPath, 'rev-parse', '--abbrev-ref', 'HEAD'])
	if (head !== branch)
		fail(`${wtPath} is on ${head}, not ${branch}`)

	const messageFlag = args.indexOf('--message-file')
	if (messageFlag === -1 || !args[messageFlag + 1])
		fail('usage: worktree.ts commit <LT-NNN> --message-file <path> [--] <path>...')
	// Absolute before git sees it: git runs with -C <worktree>, so a relative
	// -F path would resolve inside the worktree, not where the caller wrote it
	// (the workflow drafts live in the main checkout).
	const messageFile = resolve(args[messageFlag + 1])
	const paths = args.filter((a, i) => i > messageFlag + 1 && a !== '--')
	if (!paths.length)
		fail('no paths to commit — a run with no changes commits nothing (skip the commit step)')
	if (!existsSync(messageFile)) fail(`commit message file ${messageFile} not found`)
	if (!readFileSync(messageFile, 'utf8').trim()) fail(`commit message file ${messageFile} is empty`)

	const protectedHits = paths.filter(p => PROTECTED_PATHS.some(q => p === q || p.startsWith(q)))
	if (protectedHits.length)
		fail(
			`refusing to commit protected paths — the queue is managed in the main checkout and a task branch never carries them: ${protectedHits.join(', ')}`,
		)

	const staged = git(['-C', wtPath, 'diff', '--cached', '--name-only'])
	if (staged)
		fail(`${wtPath} has a staged change already; commit or unstage it first:\n${staged}`)

	// `-A` with a pathspec stages modifications, deletions and new files under
	// exactly those paths; a path that matches nothing fails git loudly, which
	// is the point — the Changed list is the contract.
	git(['-C', wtPath, 'add', '-A', '--', ...paths])
	if (!git(['-C', wtPath, 'diff', '--cached', '--name-only']))
		fail(
			'the given paths matched no change — already committed in an earlier round? Pass only this round’s paths.',
		)

	git(['-C', wtPath, '-c', 'commit.gpgsign=false', 'commit', '--no-verify', '-F', messageFile])
	const sha = git(['-C', wtPath, 'rev-parse', '--short', 'HEAD'])
	const subject = git(['-C', wtPath, 'log', '-1', '--format=%s'])
	const residue = git(['-C', wtPath, 'status', '--porcelain'])
		.split('\n')
		.filter(Boolean)
	if (residue.length)
		console.error(
			`residue left unstaged (integrate refuses a dirty worktree — restore it or name it in the Changed list):\n${residue.join('\n')}`,
		)
	console.log(JSON.stringify({ commit: sha, subject, residue }))
	process.exit(0)
}

// Merges task/<id> --no-ff into the main checkout's current branch (signed,
// owner-attended), then removes the worktree and deletes the branch.
function integrate(id: string): never {
	const wtPath = worktreePath(id)
	const branch = branchOf(id)
	if (spawnSync('git', ['rev-parse', '--verify', '--quiet', branch], { cwd: ROOT }).status !== 0)
		fail(`branch ${branch} does not exist`)

	const store = loadStore(ROOT)
	const task = store.tasks.get(id)
	if (store.problems.length || !task)
		fail(`the queue store does not name ${id} cleanly — fix the store before integrating`)
	const mergeable = ['pending-review', 'done', 'reviewed']
	if (!mergeable.includes(task.status))
		fail(
			`${id} is "${task.status}" — integrate only ${mergeable.join(', ')} tasks; rework and blocked work stays on its branch`,
		)

	const source = git(['rev-parse', '--abbrev-ref', 'HEAD'])
	if (Number(git(['rev-list', '--count', `HEAD..${branch}`])) === 0)
		fail(`${branch} carries no commits beyond ${source} — nothing to merge; remove the leftovers manually`)

	if (existsSync(wtPath)) {
		const residue = git(['-C', wtPath, 'status', '--porcelain'])
		if (residue)
			fail(
				`${wtPath} is dirty — restore or commit the residue before integrating:\n${residue}`,
			)
	}

	// --no-edit keeps the default "Merge branch 'task/<id>'" message instead of
	// opening an editor; signing follows the main checkout's config on purpose.
	const merge = spawnSync('git', ['merge', '--no-ff', '--no-edit', branch], {
		cwd: ROOT,
		encoding: 'utf8',
	})
	if (merge.status !== 0)
		fail(
			`merge of ${branch} into ${source} failed (${merge.status}) — resolve by hand or back out with git merge --abort:\n${(merge.stderr || merge.stdout).trim()}`,
		)
	const merged = git(['rev-parse', '--short', 'HEAD'])

	let worktreeRemoved = false
	if (existsSync(wtPath)) {
		// --force: the node_modules symlink is never staged, so a plain remove
		// would refuse.
		git(['worktree', 'remove', '--force', wtPath])
		worktreeRemoved = true
	}
	git(['branch', '-d', branch])

	console.log(
		JSON.stringify({ merged, source, worktreeRemoved, branchDeleted: true }),
	)
	process.exit(0)
}

const [first, ...rest] = process.argv.slice(2)

if (first === 'commit') {
	const id = rest[0]
	if (!id || !/^LT-\d+$/.test(id)) fail('usage: worktree.ts commit <LT-NNN> --message-file <path> [--] <path>...')
	commit(id, rest.slice(1))
} else if (first === 'integrate') {
	const id = rest[0]
	if (!id || !/^LT-\d+$/.test(id)) fail('usage: worktree.ts integrate <LT-NNN>')
	integrate(id)
} else {
	if (!first || !/^LT-\d+$/.test(first)) fail('usage: worktree.ts <LT-NNN> | commit <LT-NNN> … | integrate <LT-NNN>')
	bootstrap(first)
}
