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
| `compiler` (`server/compiler/`) | `server/compiler/HOST_PROFILE.md` (host decisions), `LE_TRUC_COMPILER.md` (design, diagnostic inventory) | `VOCABULARY_LEDGER.md` for names and prefixes |
| `server` (docs pipeline) | `server/SERVER.md`, `server/TESTS.md` | `references/docs-server.md` |
| `examples` | `skills/le-truc/` (authoring guidance, shipped to users) | the component's own `.md` |

When a doc and the source disagree, the source wins. Fix the doc in the same change if you can write to it. If you cannot, see *Protected files*.

## Hard rules

1. **Work the queue.** Take the task you were given. When you were given none, take the first *ready* task in `TODO.md`'s chain (`../architect/references/task-queue.md` → *The chain*). Claim it with `— in progress ⚙` before you start. Never take a task that is still only in `BACKLOG.md`.
2. **Never move entries between queue files, and never edit `ARCHITECTURE.md`.** Both belong to the Architect. Annotate the status suffix in place. Propose an `ARCHITECTURE.md` change in `NOTES.md`.
3. **Mark API changes for review.** If the change touches the public API, a compiler-authored surface's semantics, a diagnostic code's meaning, or server routes or output, mark it `— done, pending review ⏳` with a `**Changed:**` / `**How:**` / `**Check:**` handoff. Mark anything else `— done ✓` with a one-line `**Changed:**`.
4. **Stop when the plan is wrong.** If the task needs an architectural decision it does not contain, or you would deviate from it, mark it `— blocked ⛔`, write a `NOTES.md` entry, and stop. Do not design around the gap.

## Gates

Run the area's gates before you mark a task done. Add any that the task's `**Gates:**` line lists. A red gate is not done, and a flaky one is re-run once before you diagnose it (see `NOTES.md` for the known flakes). The `do-task` workflow verifies the full gate list itself — when you work a task through it, leave your work green and report no gate results; when you work a task by hand, report each gate's real result in the handoff.

| Area | Default gates |
|---|---|
| `runtime` | `bun run test:src` · `bun run lint` · `bun run typecheck` · Playwright (`bun run test`) when example behavior can change · `bun run check:size` when the bundle can grow |
| `compiler` | `bun run test:server` · `bun run lint:server` · `bun run typecheck` · `bun run check:contract` · `bun run check:corpus` · `bun run build:docs` + `bun run check:links` when emission changes · `bun run test:variants` when a variant set is touched |
| `server` | `bun run test:server` · `bun run lint:server` · `bun run build:docs` when output changes |
| `examples` | `bun run lint:examples` · `bun run test:component` for the touched component · `bun run check:corpus` |
| `docs` | `bun run check:links` · `bun run build:docs` when pages or JSDoc changed |

The **full gate**, required before an iteration milestone, is: `typecheck`, the server suite, `check:contract`, `check:corpus`, `build:docs` and `check:links`, all green on one commit.

## Obligations you would not infer

- **Every new runtime check has a channel and a tier** (ADR 0028). The task should name both. When the condition is statically decidable, the runtime class also needs an `LTC` rule. If the task names neither, raise it in `NOTES.md`; do not choose.
- **Error copy is yours to write, to the standard.** When you add, reword or retire an error class in `src/errors.ts` or a code in `server/compiler/diagnostics.ts`, follow `../writer/references/error-messages.md`. It covers the three-part message, the Tier 2 wording, the prefix choice, the propagation checklist and the message-substring tests. Retiring an error counts too: search the whole repo for the name. For a batch of messages, ask for a `writer` review in the handoff.
- **Keep the library boundary.** If a feature needs no DOM API, it belongs in `@zeix/cause-effect`, not here (`references/runtime.md`).
- **Brand parsers and method producers.** Use `asParser()` and `defineMethod()`. An unbranded function silently becomes a memo.
- **Add a regression test with every fix.** Before you treat a symptom as a bug, check `AGENTS.md` and `references/runtime-internals.md`. Many reports describe documented behavior.
- **Update the docs your change makes stale**, in the same change: JSDoc, `SERVER.md`, `HOST_PROFILE.md`, `LE_TRUC_COMPILER.md` or the pages. Ask for `writer` only for larger prose work. Never hand-edit the generated files: `docs-src/api/` and `docs/`.

## Protected files and the sandbox

- `.agents/**` is write-denied. To change a file there, write the full proposed file to the mirrored path under `.agents-proposals/` (`.agents/skills/writer/SKILL.md` → `.agents-proposals/skills/writer/SKILL.md`) and state the reason in your handoff or `NOTES.md`. Never stage `.agents/` paths. `.claude/settings*.json` and `.claude/hooks` are protected too; raise those in `NOTES.md`.
- Commit signing is unreachable from the sandbox, so leave the commit to the owner unless the session can sign. Never turn signing off.
- **End every task with a commit message** for the owner. Write the subject as `<area>: LT-NNN — <what changed>`, at most 72 characters, phrased like `git log --oneline`; use `docs(queue):` when only queue files changed. Add a body only when it carries something the diff cannot show — a ruling, a deviation, a follow-up LT-ID — in at most 3 lines. No file lists, gate transcripts or restated subject. End with the Co-Authored-By trailer.
- A fresh worktree starts on `main`, has no `node_modules` (symlink the main checkout's, unstaged) and has no built `docs/`. Run gate-touching work in the main checkout.
