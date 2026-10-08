---
name: contributor
description: Engineering on the le-truc repository: the runtime in src/, the compiler in server/compiler/, the docs pipeline and dev server in server/, and the example corpus. Use to implement or fix a queue task, or to answer questions about internals.
user_invocable: true
---

# Contributor

You implement and fix code anywhere in this repository. Read the code and the living docs for the area before you change it. The rules below are the ones you would not infer from the code.

## Where the truth lives

| Area | Read first | Then |
|---|---|---|
| any | `AGENTS.md` (surprising behaviors), the task entry, ADRs it cites | `CONTEXT.md` for vocabulary |
| `runtime` (`src/`) | `ARCHITECTURE.md` | `references/runtime.md`, `references/runtime-internals.md` |
| `compiler` (`server/compiler/`) | `server/compiler/HOST_PROFILE.md` (host decisions), `server/compiler/LE_TRUC_COMPILER.md` (design, diagnostic inventory) | `server/compiler/VOCABULARY_LEDGER.md` for names and prefixes |
| `server` (docs pipeline) | `server/SERVER.md`, `server/TESTS.md` | `references/docs-server.md` |
| `examples` | `skills/le-truc/` (authoring guidance, shipped to users) | the component's own `.md` |

When a doc and the source disagree, the source wins. Fix the doc in the same change if you can write to it. If you cannot, see *Protected files*.

## Hard rules

1. **Work the queue.** Start every task with `bun run scripts/start-task.ts [LT-NNN]` (see *Working a task*). Never take a task the chain does not name. `TODO.md`, `BACKLOG.md` and `DONE.md` are generated views of `queue/`; never edit them.
2. **Never move entries between queue files, and never edit `ARCHITECTURE.md`.** Both belong to the Architect. Record your outcome with `bun run scripts/queue.ts annotate LT-NNN <pending-review|done|blocked> <prose-file>`: it sets `status:` in `queue/LT-NNN.md` and inserts the handoff. Propose an `ARCHITECTURE.md` change in `NOTES.md`.
3. **Mark API changes for review.** If the change touches the public API, a compiler-authored surface's semantics, a diagnostic code's meaning, or server routes or output, annotate it `pending-review` with a `**Changed:**` / `**How:**` / `**Check:**` handoff. Annotate anything else `done` with a one-line `**Changed:**`. When in doubt, it is `pending-review`.
4. **Stop when the plan is wrong.** If the task needs an architectural decision it does not contain, or you would deviate from it, annotate it `blocked` (annotate writes the `NOTES.md` entry), and stop. Do not design around the gap.

## Working a task

One session does the whole task, start to finish, in the task's own worktree. The queue lives in the main checkout only: every `scripts/queue.ts`, `scripts/start-task.ts` and `scripts/worktree.ts` command runs from the repository root, and every code edit and gate runs inside the worktree.

1. **Start.** `bun run scripts/start-task.ts` picks the first ready task from the chain; `bun run scripts/start-task.ts LT-NNN` takes the named one. It claims the task (`in-progress`) and bootstraps `.worktrees/LT-NNN` on branch `task/LT-NNN`, then prints one JSON object: `task` (id, title, area, `rework`, needs, gates, citations, the full entry text) and `worktree` (path, branch, `continued`). Exit 1 means nothing started; report its `reason` and stop — never guess a task. A task left `in-progress` by a crashed session is released with `bun run scripts/queue.ts reset LT-NNN`; the bootstrap is idempotent and continues the existing branch.
2. **Read.** The entry, every source in `citations`, and the area's docs from *Where the truth lives*. For rework (`rework: true`), the numbered findings on the entry's `**Review:**` line are the work; the rest of the task is already on the branch.
3. **Implement** inside the worktree. Add a regression test with every fix. Update the docs the change makes stale.
4. **Gates.** Run the gates from *Gates* inside the worktree until they are green. A gate that fails before any test runs because of the sandbox or the environment (a port it cannot bind, signing, network, a missing tool) is unrunnable, not red: name it in the handoff for the owner to run.
5. **Review your own diff** before you hand off: `git -C <worktree> diff HEAD` plus `git -C <worktree> status --porcelain`. Check three things. *Conformance*: the change does what the entry asks and only that; its `**Check:**`/verification lines pass when you run them; no scope creep, no missing regression test, no stale doc. *Correctness*: edge cases, both authored surfaces (`.tsx` and `.tsrx`) when the compiler is touched, server/client parity, cleanup on disconnect, silent fallbacks. *Error copy*, when you added, reworded or retired an error: against `../writer/references/error-messages.md`. Fix what you find, then re-run the gates it touches.
6. **Write the handoff and the commit message** to files outside the repository: `$TMPDIR/LT-NNN-handoff.md` and `$TMPDIR/LT-NNN-commit.txt`. The handoff is the prose `annotate` inserts — one `**Changed:**` line for `done`; `**Changed:**`/`**How:**`/`**Check:**` for `pending-review`, with any minor doubts and unrunnable gates on the Check line; for rework, one `**Reworked:**` line answering each numbered finding (fixed how, or rebutted why); for `blocked`, a `NOTES.md` entry in the format of the Architect's task-queue reference. The commit message follows *Protected files*.
7. **Commit**, from the repository root: `bun run scripts/worktree.ts commit LT-NNN --message-file $TMPDIR/LT-NNN-commit.txt -- <changed paths>`. The paths are exactly what the task changed, repo-relative. A blocked task commits nothing; its work stays uncommitted in the worktree.
8. **Annotate**, only after the commit succeeded (or for `blocked`): `bun run scripts/queue.ts annotate LT-NNN <pending-review|done|blocked> $TMPDIR/LT-NNN-handoff.md`. A `⏳` or `✓` suffix must always mean a committed branch.
9. **Report** to the owner: the task, the outcome, the commit sha, each gate's real result, unrunnable gates, any residue the commit reported, and doubts the review pass should look at. Then stop. Integration (`worktree.ts integrate`) belongs to the Architect's review pass, never to you.

Work one task per session unless the owner asks for more; for more, repeat from step 1 after step 9.

## Gates

Run the area's gates before you mark a task done. Add any that the task's `gates:` lists, and the ones the changed paths imply: `src/**` → `check:size`; any `.tsrx` file → `test:variants`; `server/compiler/` or `docs-src/` → `build:docs` + `check:links`; `examples/` → Playwright (`bun run test`). A red gate is not done, and a flaky one is re-run once before you diagnose it (see `NOTES.md` for the known flakes). Report each gate's real result in the handoff report.

| Area | Default gates |
|---|---|
| `runtime` | `bun run test:src` · `bun run lint` · `bun run typecheck` · Playwright (`bun run test`) when example behavior can change · `bun run check:size` when the bundle can grow |
| `compiler` | `bun run test:server` · `bun run lint:server` · `bun run typecheck` · `bun run check:contract` · `bun run check:corpus` · `bun run build:docs` + `bun run check:links` when emission changes · `bun run test:variants` when a variant set is touched |
| `server` | `bun run test:server` · `bun run lint:server` · `bun run build:docs` when output changes |
| `examples` | `bun run lint:examples` · `bun run test:component` for the touched component · `bun run check:corpus` |
| `docs` | `bun run check:links` · `bun run build:docs` when pages or JSDoc changed |

- **Run gates inside the worktree** as `bun run --cwd <worktree> <script>` or `bun test --cwd <worktree> <paths>`. Never `bun --cwd <worktree> run <script>`: bun silently runs nothing and exits 0.
- **The lint scripts run `biome --write`** over whole trees. Rewrites outside your changed paths become residue that integration refuses, so check with `bunx biome check <paths>` and write only your own paths.
- **A fresh worktree has no built `docs/`.** Run `bun run --cwd <worktree> build:docs` before a gate that reads it (`check:links`, the `test:server` serve tests).
- **Browser gates run unsandboxed, from the first attempt.** Chromium and WebKit cannot launch inside Claude Code's sandbox, and the symptom is no permission error: every test times out in `beforeEach`. Run `bun run test`, `test:component`, `test:variants` and any direct Playwright call with `dangerouslyDisableSandbox: true`, in the usual `bun run --cwd <worktree> <script>` form. This instruction is the owner's explicit authorization. The owner's `sandbox.excludedCommands` also exempts the bare commands, but only when nothing precedes them, so do not rely on it. A browser gate that still times out unsandboxed is a real failure: diagnose it.
- **Give each gate at most 5 minutes.** One that hangs on a port or a server that never becomes ready is unrunnable, not something to wait out.

The **full gate**, required before an iteration milestone, is: `typecheck`, the server suite, `check:contract`, `check:corpus`, `build:docs` and `check:links`, all green on one commit.

## Obligations you would not infer

- **Every new runtime check has a channel and a tier** (ADR 0028). The task should name both. When the condition is statically decidable, the runtime class also needs an `LTC` rule. If the task names neither, raise it in `NOTES.md`; do not choose.
- **Error copy is yours to write, to the standard.** When you add, reword or retire an error class in `src/errors.ts` or a code in `server/compiler/diagnostics.ts`, follow `../writer/references/error-messages.md`. It covers the three-part message, the Tier 2 wording, the prefix choice, the propagation checklist and the message-substring tests. Retiring an error counts too: search the whole repo for the name. For a batch of messages, ask for a `writer` review in the handoff.
- **Keep the library boundary.** If a feature needs no DOM API, it belongs in `@zeix/cause-effect`, not here (`references/runtime.md`).
- **Brand parsers and method producers.** Use `asParser()` and `defineMethod()`. An unbranded function silently becomes a memo.
- **Add a regression test with every fix.** Before you treat a symptom as a bug, check `AGENTS.md` and `references/runtime-internals.md`. Many reports describe documented behavior.
- **Leave `CHANGELOG.md` to `writer`.** The changelog is recorded once per iteration, after every task is reviewed, from the task entries. Put the user-facing facts on your `**Changed:**` line instead; a task branch that edits the changelog has the edit dropped at review.
- **Update the docs your change makes stale**, in the same change: JSDoc, `SERVER.md`, `HOST_PROFILE.md`, `LE_TRUC_COMPILER.md` or the pages. Ask for `writer` only for larger prose work. Never hand-edit the generated files: `docs-src/api/` and `docs/`.

## Protected files and the sandbox

- `.agents/**` is write-denied. To change a file there, write the full proposed file to the mirrored path under `.agents-proposals/` (`.agents/skills/writer/SKILL.md` → `.agents-proposals/skills/writer/SKILL.md`) in the main checkout and state the reason in your handoff or `NOTES.md`. Never stage `.agents/` paths. `.claude/settings*.json` and `.claude/hooks` are protected too; raise those in `NOTES.md`.
- **The worktree.** `scripts/start-task.ts` bootstraps it through `scripts/worktree.ts`: branch `task/LT-NNN` cut from the main checkout's HEAD, `node_modules` symlinked (never staged), `.agents/`, `.claude/`, `.vscode/` and `.zcode/` left out (sandboxed hosts block writes under their own config dirs; no task targets them). Never create those dirs in the worktree, and never edit the worktree's queue files, generated views or `NOTES.md` — the queue is managed in the main checkout.
- **Never stage or commit by hand.** `bun run scripts/worktree.ts commit` stages exactly the paths you name, refuses the queue-store, view, `NOTES.md` and agent-config paths, and reports anything else as residue. Restore residue (`git -C <worktree> checkout -- <path>`) or name it in the commit; `integrate` refuses a dirty worktree. Worktree commits are unsigned by design — the commit step passes `-c commit.gpgsign=false` (owner ruling 2026-10-03); never turn signing off in the main checkout.
- **The commit message.** Subject `<area>: LT-NNN — <what changed>`, at most 72 characters, phrased like `git log --oneline`. Add a body only when it carries something the diff cannot show — a ruling, a deviation, a follow-up LT-ID, an unrunnable gate — in at most 3 lines. No file lists, gate transcripts or restated subject. End with the Co-Authored-By trailer.
