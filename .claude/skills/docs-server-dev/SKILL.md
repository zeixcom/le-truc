---
name: docs-server-dev
description: >
  Expert developer for the le-truc docs build pipeline and dev server. Use when
  implementing features, fixing bugs, adding Markdoc schemas, writing tests, or answering
  questions about the Bun + Cause & Effect + Markdoc + TypeDoc + Shiki stack in server/.
user_invocable: false
---

<scope>
This skill is for development work on the **build pipeline and dev server** in `server/`.

**In scope:**
- `server/` — effects, templates, schemas, file signals, HTTP server, HMR, config, io, helpers
- `typedoc.json` and `typedoc-heading-shift.mjs` — TypeDoc pipeline configuration
- `docs-src/` — as read-only input; do not author content here (use `tech-writer`)
- `src/` — as read-only input for TypeDoc; do not change library source here (use `le-truc-dev`)
- `docs/` — as write-only output; do not edit files here manually

**Out of scope — use a different skill:**
- `docs-src/pages/*.md` content authoring → use `tech-writer`
- `src/` library source → use `le-truc-dev`
- `examples/` component source → use `le-truc` or `le-truc-dev`
- Playwright tests in `examples/*.spec.ts` → those test components, not the server
</scope>

<essential_principles>
**This is Bun, not Node.js.** Use `Bun.serve`, `Bun.Glob`, `Bun.file`, `bun:test`, and Bun APIs throughout. Never reach for `node:fs`, `node:http`, or `node:path` when a Bun equivalent exists.

**Cause-effect drives the build pipeline, not the DOM.** `List<FileInfo>` signals represent watched directories. Effects (`createEffect` + `match`) re-run when source files change and write output to `docs/`. This is cause-effect as a reactive build graph — not a UI reactivity system.

**Two `html` tags exist — they are completely different.** This is the most common source of bugs:
- `templates/utils.ts` → `html` produces **auto-escaped HTML strings** for page output
- `markdoc-helpers.ts` → `html` is a **Markdoc Tag builder** that produces `Tag` objects

Never use the templates `html` tag inside a Markdoc schema transform. Never use the markdoc-helpers `html` tag to produce output strings.

**All template output is auto-escaped by default.** The `html`, `xml`, `css`, and `js` tagged template literals in `templates/utils.ts` escape all interpolated values. Use `raw()` / `RawHtml` only for content that is already trusted and sanitised (Shiki-highlighted HTML, previously validated Markdoc output).

**`SERVER.md` is the authoritative architecture document.** Read it before changing any major component. `TESTS.md` governs all test decisions.

**Run `bun test server/tests` after every change.**

**Run the linter** after every change to `server/`: `bunx biome check --write ./server`.
</essential_principles>

<intake>
What kind of task is this?

1. **Implement** — add or extend build pipeline or server functionality
2. **Fix** — debug unexpected build or server behavior
3. **Add schema** — create a new Markdoc tag
4. **Test** — write or update server tests
5. **Question** — understand the architecture or a specific component

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Workflow |
|---|---|
| 1, "implement", "add", "extend", "build", "create", "new effect", "new template" | workflows/implement-feature.md |
| 2, "fix", "bug", "broken", "wrong", "unexpected", "debug" | workflows/fix-bug.md |
| 3, "schema", "markdoc tag", "new tag" | workflows/add-markdoc-schema.md |
| 4, "test", "spec", "coverage", "write tests" | workflows/write-tests.md |
| 5, "question", "explain", "how", "why", "what", "understand" | workflows/answer-question.md |

**Intent-based routing** (clear intent without selecting):
- Describes build/server code to write → workflows/implement-feature.md
- Describes something not working in the build or server → workflows/fix-bug.md
- Wants to add a new Markdoc tag → workflows/add-markdoc-schema.md
- Wants to add or update tests for server code → workflows/write-tests.md
- Asks how something works → workflows/answer-question.md

**After identifying the workflow, read it and follow it exactly.**
</routing>

<reference_index>
All in `references/`:

| File | Contents |
|---|---|
| source-map.md | Authoritative documents + source file locations quick lookup |
| architecture.md | System layers, data flow, file signals, effects table, HTTP routes, HMR |
| effect-pattern.md | Standard build effect structure, `createEffect` + `match` + `ready` contract |
| markdoc-schema.md | Schema authoring: simple vs. transform schemas, helpers, attribute system |
| template-system.md | `html`/`xml`/`css`/`js` template tags, escaping, `raw()`, composition utilities |
| testing.md | Test categories, commands, file conventions, test-utils.ts helper API |
</reference_index>

<post_task_protocol>
After completing any task, in this order:

1. **Run tests:** `bun test server/tests` — all tests must pass
2. **Run linter:** `bunx biome check --write ./server` — no new lint errors
3. **Update TODO.md** (only if the task was assigned via TODO.md):
   - If the change affects **server API, HTTP routes, build pipeline behavior, or template output** → mark `— done, pending review ⏳` and add handoff:
     ```
     **Changed:** which file(s) and what (function name, route, effect)
     **How:** key implementation note (1–2 sentences)
     **Check:** what the Architect should focus on
     ```
   - If the change is a **bug fix, test, or config tweak** → mark `— done ✓` and add `**Changed:**` only
4. **Write to NOTES.md** if you encountered an unexpected challenge or want to deviate from the plan:
   - Use the format defined in the `architect` skill's `<notes_format>` section
   - Stop work on the task — do not continue on assumptions
   - Wait for Architect or user to resolve before proceeding
</post_task_protocol>

<workflows_index>
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| implement-feature.md | Add or extend build pipeline or server functionality |
| fix-bug.md | Diagnose and fix unexpected build or server behavior |
| add-markdoc-schema.md | Create a new Markdoc tag schema end-to-end |
| write-tests.md | Write or update tests for server code |
| answer-question.md | Answer questions about the architecture or a specific component |
</workflows_index>
