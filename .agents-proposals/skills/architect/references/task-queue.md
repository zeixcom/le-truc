# Task Queue

The queue is a per-task store: one `queue/LT-NNN.md` per task, plus the prose files `queue/ITERATION.md`, `queue/BANDS.md` and `queue/LEDGER.md`. `BACKLOG.md`, `TODO.md` and `DONE.md` are generated views — `bun run queue:build` renders them from the store, and a hand edit is lost on the next build. Task IDs (`LT-NNN`) are unique by construction (the filename is the ID) and sequential; the "Next free task ID" line lives in the `queue/ITERATION.md` header.

The format and the chain below are **machine-enforced**: `bun run check:queue` validates every rule in *Entry format* and *The chain*, and the `do-task` workflows (`.zcode/workflows/do-task.dwf.ts` for ZCode, `.claude/workflows/do-task.js` for Claude Code) pick, claim and annotate only through `bun run scripts/queue.ts` — never by editing a store file directly. This page is the contract that script implements; when the contract and the script disagree, fix one of them in the same commit.

| File | Holds | Who writes |
|---|---|---|
| `queue/LT-NNN.md` | One task. YAML front matter carries the machine fields (`id`, `title`, `area`, `status`, `note`, `needs`, `gates`, `band`); the body is the entry prose. | Architect creates entries and moves them (a `status:`/`band:` edit). Contributors claim and annotate through `bun run scripts/queue.ts`. |
| `queue/ITERATION.md` | The TODO view's prose: the header, rulings, **the chain** | Architect only |
| `queue/BANDS.md` | The BACKLOG view's prose: the static explainer and the band preambles | Architect only |
| `queue/LEDGER.md` | The DONE view's prose: the compaction policy, the rulings carried from prunes, open obligations | Architect only |
| `BACKLOG.md` / `TODO.md` / `DONE.md` | Generated views — never hand-edit them; `bun run queue:build` renders them | Nobody by hand |

## Entry format

The views render each task in this format; here from `TODO.md`:

```markdown
- [ ] LT-410: Brief imperative title
  **Area:** compiler
  **Needs:** LT-371, LT-375
  **Gates:** check:sim
  **Context:** What to do and why, with the ADR or ARCHITECTURE.md section it traces to.
  Name the error channel and tier for any new runtime check (ADR 0028).

- [x] LT-411: Brief title — done, pending review ⏳
  **Area:** runtime
  **Changed:** `src/helpers/reactive.ts` (`makeEach()`)
  **How:** One or two sentences on the approach.
  **Check:** Where the reviewer should look.

- [x] LT-412: Brief title — reviewed ✓
  **Area:** runtime
  **Review:** Approved. One line, only if it records a ruling or a nit the reviewer fixed.

- [x] LT-413: Brief title — changes requested ↩
  **Area:** compiler
  **Changed:** …
  **Review:** (1) What is wrong, where. (2) … Nits fixed by the reviewer: the JSDoc on `foo()`.
```

In the store the machine fields live in the task file's front matter and the rest is its body; the views render the block above from it:

```markdown
---
id: LT-410
title: Brief imperative title
area: compiler
status: open
needs: [LT-371, LT-375]
gates: [check:sim]
band: P2b
---

What to do and why, with the ADR or ARCHITECTURE.md section it traces to.
Name the error channel and tier for any new runtime check (ADR 0028).
```

| Field | Required | Meaning |
|---|---|---|
| `area:` | yes | `runtime` (`src/`), `compiler` (`server/compiler/`, `scripts/` corpus tooling), `server` (docs pipeline, dev server), `examples`, `docs` (prose, JSDoc, error copy), `design` (needs the Architect or owner; never auto-picked) |
| `needs:` | when it has prerequisites | LT-IDs that must be `done ✓`, `done, pending review ⏳` or `reviewed ✓` before this task is ready. A pending review or a `changes requested ↩` satisfies a prerequisite: rework stays inside the task's scope and keeps dependents' gates green. A finding that would change what a dependent relies on is a follow-up task, not rework. A compacted ID that only `queue/LEDGER.md` mentions counts as satisfied. |
| `gates:` | when it needs more than the area's defaults | Extra commands from `package.json` (`contributor` → *Gates*) |
| `band:` | for tasks outside the iteration | The BACKLOG band the task belongs to (`P1`…`P7`, with lettered sub-bands such as `P2b`); an iteration task keeps its origin band. |
| `status:` | yes | The suffix below |
| body (`**Context:**`) | yes, for open tasks | Enough that the contributor makes no architectural decision |

### Status suffixes

The suffix is the task's `status:` front-matter field. The contributor writes it through `bun run scripts/queue.ts claim` and `annotate`; the Architect updates it on review (a `status:` edit, then `bun run queue:build`).

| Suffix | `status:` | Meaning |
|---|---|---|
| *(none)* | `open` | Open |
| `— in progress ⚙` | `in-progress` | Claimed by a running session or workflow. Prevents double pickup. |
| `— done, pending review ⏳` | `pending-review` | The change touches the public API, compiler-authored surface semantics, a diagnostic code's meaning, or server routes or output. The entry carries a `Changed`/`How`/`Check` handoff, and the commit sits on the task's branch. |
| `— done ✓` | `done` | A bug fix, test, internal change, or docs change. The entry carries a one-line `Changed`, and the commit sits on the task's branch. |
| `— changes requested ↩` | `changes-requested` | Review found work inside the task's scope. The `**Review:**` line numbers the findings. The contributor fixes them in the same task, adds a `**Reworked:**` line, and sets the suffix again. |
| `— reviewed ✓` | `reviewed` | The Architect approved it. |
| `— blocked ⛔` | `blocked` | The contributor stopped. An entry in `NOTES.md` explains why. |

A few entries carry a non-contract closed tail instead (`parked`, `closed as moot`, `rolled back`) — in the store, `status: note` with a `note:` field holding the raw tail. The queue tool classifies these as closed, so they never block a pick; normalize one to a contract status when you touch the entry.

## Where the work happens

`do-task` never implements in the main checkout. Per task it bootstraps `.worktrees/LT-NNN` — a git worktree on branch `task/LT-NNN` cut from the current HEAD, with the main checkout's `node_modules` symlinked in (`bun run scripts/worktree.ts LT-NNN`, idempotent). Consequences:

- **The queue never lives in a worktree.** Pick, claim and annotate run `scripts/queue.ts` against the main checkout only. The commit step enforces this mechanically: `bun run scripts/worktree.ts commit <LT-NNN> --message-file <path> -- <paths>` refuses the protected paths (the store, the generated views, `NOTES.md`, the agent-config dirs) even when a handoff wrongly lists them. This — not locking — is what prevents two agents from colliding.
- **A task's diff is its branch's diff.** A run commits its work at finish, staging exactly the handoff's Changed paths, so gate-run churn never rides and anything else left in the worktree is reported as residue. The review pass reads `git diff HEAD...task/LT-NNN` — an immutable snapshot, not a moving worktree; a `⏳` suffix always means a committed branch.
- **Worktree commits are unsigned; integration is signed.** The commit step passes `-c commit.gpgsign=false` (owner ruling 2026-10-03) so an agent run can commit without the owner's signing key, touching no config file; the bootstrap additionally sets `commit.gpgsign=false` worktree-locally (`extensions.worktreeConfig`) where the host allows config writes and skips it with a note where it does not (Claude Code's sandbox blocks `.git/config`). Task branches are local-only. The merge back runs in the owner-attended review pass: `bun run scripts/worktree.ts integrate <LT-NNN>` refuses a dirty worktree and a task whose status is not `pending-review`/`done`/`reviewed`, merges `--no-ff` into the current branch (signed), and removes the worktree and the branch. A merge conflict is resolved by hand — it is two tasks overlapping, a design call. One branch integrates at a time, in pick order.
- **Worktrees never materialize the agent-config dirs `.agents/`, `.claude/`, `.vscode/`, `.zcode/`.** The bootstrap creates the worktree `--no-checkout`, populates its index from HEAD, marks those paths skip-worktree, and only then checks the rest out. Sandboxed hosts (Claude Code among them) refuse writes under their own config dirs, so a plain checkout dies materializing them (`.vscode/settings.json` first). No task targets these dirs; edits and staging of them happen in the main checkout only. Re-running the bootstrap on a branch that already carries its task's commits continues that branch (rework) instead of failing.
- Gates run with the worktree as cwd: `bun run --cwd <path> <script>`, `bun test --cwd <path> <paths>`. Never `bun --cwd <path> run <script>` — bun silently ignores that form (exit 0, nothing runs).
- Fresh worktrees lack built `docs/`; a gate that reads it (`test:server` serve tests, `check:links`) runs `build:docs` first.

## The chain

`queue/ITERATION.md` has a `**The chain.**` section that orders the iteration; it renders verbatim into `TODO.md`, with the tracks' open entries appended beneath it. The `do-task` workflow reads it with no human present, so keep it mechanical:

- Group the tasks into tracks with one line of purpose each. Inside a track, list the tasks in pick order.
- A task is **ready** when four things hold: it has no suffix, its `Area` is not `design`, every LT-ID in its `**Needs:**` is satisfied, and every earlier task in its track is satisfied or `blocked ⛔`.
- `do-task` first takes any `— changes requested ↩` task, in chain order. Then it picks the first ready task, tracks in order. When nothing is ready, it stops and reports why. It does not guess.
- A track whose next task is claimed (`⚙`) or on a non-contract status **stalls**: that task and everything behind it in that track is skipped, and the scan falls through to the next track. A `blocked ⛔` task is skipped and the track continues.
- When the order depends on a ruling that a `Needs:` field cannot express, write the ruling into the header's rulings list and the dependency into `Needs:`.

`bun run scripts/queue.ts pick [LT-NNN]` prints this decision as JSON, and `list [--status <status>]` prints the store's tasks as JSON (both read-only; `claim`, `annotate`, `reset` are the write commands, and each write re-renders the views). `bun run check:queue` runs the store suite, then fails the build when a task file is malformed, a `Needs:` or chain reference names no task file (a `queue/LEDGER.md` mention satisfies), an ID disagrees with its filename, or a view is stale against `queue/` — run `bun run queue:build`; an open, unbanded, unchained task is reported as a note.

## Moves (Architect only)

A move is an edit in the store — a `status:`/`band:` field in `queue/LT-NNN.md`, or the chain in `queue/ITERATION.md` — followed by `bun run queue:build`. Never hand-edit the views.

- **Iteration planning**: write the header (what the iteration is and why now), the rulings and the chain into `queue/ITERATION.md`. Naming an entry in the chain is the move into the iteration; deleting it from the chain moves it back to its band in `BACKLOG.md`. Bump the next free task ID.
- **After review**: the `review-pending` workflow (`.zcode/workflows/review-pending.dwf.ts`, `.claude/workflows/review-pending.js`) proposes the verdicts, the Review lines and the merge plan; you confirm them in the owner-attended pass. An approval compacts the task file in place and sets `status: reviewed`: keep the ID, the title, the final status, rulings recorded nowhere else (those go into `queue/LEDGER.md`), live handoffs into open tasks (by LT-ID), and the changed-artifact facts the changelog needs; drop verification transcripts and file-line inventories. Integration runs `bun run scripts/worktree.ts integrate <LT-NNN>`. A `changes requested ↩` sets `status: changes-requested`, with the numbered findings on the Review line.
- **After a release**: run `release-notes` (`.claude/workflows/release-notes.js`) first — it records the reviewed entries in `CHANGELOG.md [Unreleased]` and names what it consumed. Prune from that `consumed` list: delete each consumed `queue/LT-NNN.md`, carry rulings with no other home into `queue/LEDGER.md` under a dated prune note (the 2026-10-03 sixth pass is the worked example), then `bun run queue:build`. Before you plan a release, run `skill-drift` (`.claude/workflows/skill-drift.js`) per unit — a full run is ~19 agents — so the shipped skills and `AGENTS.md` go out un-drifted.

## `NOTES.md` entry format

```markdown
---

## LT-NNN — Brief challenge title
**Date:** YYYY-MM-DD | **Area:** compiler
**Issue:** What was unexpected, or the deviation proposed.
**Options:** (a) … (b) …
**Question:** The specific question for the Architect or the owner.
```

`NOTES.md` is for blockers and deviations only. Proposed edits to `.agents/` files go to the mirrored path under `.agents-proposals/` (see `contributor` → *Protected files*).
