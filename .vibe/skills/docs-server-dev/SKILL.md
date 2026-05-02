---
name: docs-server-dev
description: Expert developer for the le-truc docs build pipeline and dev server. Use when implementing features, fixing bugs, adding Markdoc schemas, writing tests, or answering questions about the Bun + Cause & Effect + Markdoc + TypeDoc + Shiki stack in server/.
user_invocable: false
---

## Scope

**In scope:**
- `server/` — effects, templates, schemas, file signals, HTTP server, HMR, config, io, helpers
- `typedoc.json` and `typedoc-heading-shift.mjs` — TypeDoc pipeline configuration
- `docs-src/` — as read-only input; do not author content here
- `src/` — as read-only input for TypeDoc; do not change library source here
- `docs/` — as write-only output; do not edit files here manually

**Out of scope:**
- `docs-src/pages/*.md` content authoring → use `tech-writer`
- `src/` library source → use `le-truc-dev`
- `examples/` component source → use `le-truc` or `le-truc-dev`
- Playwright tests in `examples/*.spec.ts` → those test components, not the server

## Essential Principles

**Bun, not Node.js.** Use `Bun.serve`, `Bun.Glob`, `Bun.file`, `bun:test`, and Bun APIs throughout. Never use `node:fs`, `node:http`, or `node:path` when Bun equivalents exist.

**Cause-effect drives the build pipeline.** `List<FileInfo>` signals represent watched directories. Effects (`createEffect` + `match`) re-run when source files change and write output to `docs/`. This is cause-effect as a reactive build graph.

**Two `html` tags exist — they are completely different:**
- `templates/utils.ts` → `html` produces **auto-escaped HTML strings** for page output
- `markdoc-helpers.ts` → `html` is a **Markdoc Tag builder** that produces `Tag` objects

Never use the templates `html` inside a Markdoc schema transform. Never use markdoc-helpers `html` to produce output strings.

**All template output is auto-escaped by default.** The `html`, `xml`, `css`, and `js` tagged template literals in `templates/utils.ts` escape all interpolated values. Use `raw()`/`RawHtml` only for content that is already trusted: Shiki-highlighted HTML, previously validated Markdoc output, or output from other template functions.

**`SERVER.md` is authoritative.** Read it before changing any major component.

**Run `bun test server/tests` after every change.**

**Run the linter** after every change to `server/`: `bunx biome check --write ./server`.

## Task Types

1. **Implement** — add or extend build pipeline or server functionality
2. **Fix** — debug unexpected build or server behavior
3. **Add schema** — create a new Markdoc tag
4. **Test** — write or update server tests
5. **Question** — understand the architecture or a specific component

## Quick Reference

| Need | Location |
|------|----------|
| Architecture overview, effects table, file signals, HTTP routes, HMR | `server/SERVER.md` |
| Test strategy, conventions, verification | `server/TESTS.md` |
| Open tasks and design decisions | `server/TASKS.md` |
| Template system design | `server/templates/README.md` |
| Source file locations | `server/SERVER.md` source files section |

## Routing

| Task | Workflow |
|------|----------|
| Implement feature, add effect, extend build, create template | Follow effect-pattern.md or template-system.md |
| Fix bug, debug behavior | Follow fix-bug.md |
| Add Markdoc tag/schema | Follow markdoc-schema.md |
| Write tests | Follow testing.md |
| Answer question | Follow architecture docs in SERVER.md |

## Post-Task Protocol

After completing any task, in order:

1. **Run tests:** `bun test server/tests` — all tests must pass
2. **Run linter:** `bunx biome check --write ./server` — no new lint errors
3. **Update TODO.md** (only if task was assigned via TODO.md):
   - If change affects **server API, HTTP routes, build pipeline behavior, or template output** → mark `— done, pending review ⏳` and add handoff:
     ```
     **Changed:** which file(s) and what (function name, route, effect)
     **How:** key implementation note (1-2 sentences)
     **Check:** what the Architect should focus on
     ```
   - If change is a **bug fix, test, or config tweak** → mark `— done ✓` and add `**Changed:**` only
4. **Write to NOTES.md** if you encountered an unexpected challenge or want to deviate from the plan:
   - Use the format defined in the `architect` skill's notes format
   - Stop work on the task
   - Wait for Architect or user to resolve before proceeding
