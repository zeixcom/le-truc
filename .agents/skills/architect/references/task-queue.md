# Task Queue

The queue is three files. Task IDs (`LT-NNN`) are global and sequential across all three. The `TODO.md` header tracks the next free ID.

The format and the chain below are **machine-enforced**: `bun run check:queue` validates every rule on this page, and the `do-task` workflows (`.zcode/workflows/do-task.dwf.ts` for ZCode, `.claude/workflows/do-task.js` for Claude Code) pick, claim and annotate only through `bun run scripts/queue.ts` — never by editing a queue file directly. This page is the contract that script implements; when the contract and the script disagree, fix one of them in the same commit.

| File | Holds | Who writes |
|---|---|---|
| `BACKLOG.md` | Everything planned but out of iteration scope. New tasks are created here. | Architect creates entries. Anyone may annotate a suffix in place. |
| `TODO.md` | The current iteration: header, rulings, **the chain**, entries | Architect moves entries in and keeps the chain. Contributors annotate suffixes in place. |
| `DONE.md` | Compacted done-and-reviewed entries since the last release; the release-notes source | Architect only |

## Entry format

The format is the same in all three files.

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

| Field | Required | Meaning |
|---|---|---|
| `**Area:**` | yes | `runtime` (`src/`), `compiler` (`server/compiler/`, `scripts/` corpus tooling), `server` (docs pipeline, dev server), `examples`, `docs` (prose, JSDoc, error copy), `design` (needs the Architect or owner; never auto-picked) |
| `**Needs:**` | when it has prerequisites | LT-IDs that must be `done ✓`, `done, pending review ⏳` or `reviewed ✓` before this task is ready. A pending review or a `changes requested ↩` satisfies a prerequisite: rework stays inside the task's scope and keeps dependents' gates green. A finding that would change what a dependent relies on is a follow-up task, not rework. |
| `**Gates:**` | when it needs more than the area's defaults | Extra commands from `package.json` (`contributor` → *Gates*) |
| `**Context:**` | yes, for open tasks | Enough that the contributor makes no architectural decision |

### Status suffixes

The contributor writes the suffix. The Architect updates it on review.

| Suffix | Meaning |
|---|---|
| *(none)* | Open |
| `— in progress ⚙` | Claimed by a running session or workflow. Prevents double pickup. |
| `— done, pending review ⏳` | The change touches the public API, compiler-authored surface semantics, a diagnostic code's meaning, or server routes or output. The entry carries a `Changed`/`How`/`Check` handoff. |
| `— done ✓` | A bug fix, test, internal change, or docs change. The entry carries a one-line `Changed`. |
| `— changes requested ↩` | Review found work inside the task's scope. The `**Review:**` line numbers the findings. The contributor fixes them in the same task, adds a `**Reworked:**` line, and sets the suffix again. |
| `— reviewed ✓` | The Architect approved it. |
| `— blocked ⛔` | The contributor stopped. An entry in `NOTES.md` explains why. |

A few entries carry a non-contract closed suffix instead (`parked`, `closed as moot`, `rolled back`). The queue tool classifies any of these as closed, so they never block a pick; normalize one to a contract status when you touch the entry.

## Where the work happens

`do-task` never implements in the main checkout. Per task it bootstraps `.worktrees/LT-NNN` — a git worktree on branch `task/LT-NNN` cut from the current HEAD, with the main checkout's `node_modules` symlinked in (`bun run scripts/worktree.ts LT-NNN`, idempotent). Consequences:

- **The queue never lives in a worktree.** Pick, claim and annotate run `scripts/queue.ts` against the main checkout only, so a task branch never touches a queue file and merging it back is clean even with the workflow's own suffix edits uncommitted. This — not locking — is what prevents two agents from colliding.
- **A task's diff is its worktree's diff.** Reviewers and the owner read `git -C .worktrees/LT-NNN diff HEAD`; earlier tasks in the same run are invisible.
- **Worktrees never materialize the agent-config dirs `.agents/`, `.claude/`, `.vscode/`, `.zcode/`.** The bootstrap creates the worktree `--no-checkout`, populates its index from HEAD, marks those paths skip-worktree, and only then checks the rest out. Sandboxed hosts (Claude Code among them) refuse writes under their own config dirs, so a plain checkout dies materializing them (`.vscode/settings.json` first). No task targets these dirs; edits and staging of them happen in the main checkout only.
- Gates run with the worktree as cwd: `bun run --cwd <path> <script>`, `bun test --cwd <path> <paths>`. Never `bun --cwd <path> run <script>` — bun silently ignores that form (exit 0, nothing runs).
- Fresh worktrees lack built `docs/`; a gate that reads it (`test:server` serve tests, `check:links`) runs `build:docs` first.

After the owner commits and merges a task branch: `git worktree remove --force .worktrees/LT-NNN && git branch -d task/LT-NNN`.

## The chain

`TODO.md` has a `**The chain.**` section that orders the iteration. The `do-task` workflow reads it with no human present, so keep it mechanical:

- Group the tasks into tracks with one line of purpose each. Inside a track, list the tasks in pick order.
- A task is **ready** when four things hold: it has no suffix, its `Area` is not `design`, every LT-ID in its `**Needs:**` is satisfied, and every earlier task in its track is satisfied or `blocked ⛔`.
- `do-task` first takes any `— changes requested ↩` task, in file order. Then it picks the first ready task, tracks in order. When nothing is ready, it stops and reports why. It does not guess.
- A track whose next task is claimed (`⚙`) or `blocked ⛔` **stalls**: that task and everything behind it in that track is skipped, and the scan falls through to the next track. A `blocked ⛔` does not end the iteration.
- When the order depends on a ruling that a `Needs:` field cannot express, write the ruling into the header's rulings list and the dependency into `Needs:`.

`bun run scripts/queue.ts pick [LT-NNN]` prints this decision as JSON (read-only; `claim`, `annotate`, `reset` are the write commands). `bun run check:queue` fails the build when an entry breaks the format, a `Needs:` reference dangles, IDs collide, or the checkbox and suffix disagree; an open entry the chain does not name is reported as a note.

## Moves (Architect only)

- **Iteration planning**: move the entries from `BACKLOG.md` into `TODO.md`, write the header (what the iteration is and why now), the rulings and the chain, and bump the next free ID.
- **After review**: move the entry to `DONE.md` in compacted form. Keep the ID, the title, the final status, rulings recorded nowhere else, live handoffs into open tasks (by LT-ID), and the changed-artifact facts the changelog needs. Drop verification transcripts and file-line inventories.
- **After a release**: prune the `DONE.md` entries that the changelog now covers.

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
