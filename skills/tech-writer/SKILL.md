---
name: tech-writer
description: >
  Keep le-truc developer-facing documents up to date with the source code and examples:
  docs-src/pages/, README.md, ARCHITECTURE.md, CLAUDE.md, and JSDoc in src/.
  Use after code changes, to verify consistency, or to update a specific document.
user_invocable: false
---

<scope>
This skill maintains the **authored documentation** for the @zeix/le-truc library.

**In scope:** `docs-src/pages/`, `README.md`, `ARCHITECTURE.md`, `CLAUDE.md`, JSDoc in `src/`.

**Out of scope — do not edit:**
- `docs-src/api/` — TypeDoc-generated from source; regenerate with `bun run build:docs` instead
- `examples/*/` — component source files; use the `le-truc` or `le-truc-dev` skill instead
- `CHANGELOG.md` — use the `changelog-keeper` skill instead
- Build scripts, server code, or test infrastructure
</scope>

<essential_principles>
**Read source before writing.** Always read the current state of the source file(s) and the target document before making any changes. Never update from memory.

**Tone adapts to audience.** Each document has a distinct primary reader and register. See references/tone-guide.md. Violating the tone is as wrong as a factual error.

**Concise over comprehensive.** Every sentence must justify its presence. Cut anything that does not add information the reader needs.

**Surgical edits only.** Update what changed. Do not rewrite sections that are still accurate, and do not add commentary about what was updated.

**Pages are Markdoc, not plain Markdown.** `docs-src/pages/` files use Markdoc tags (`{% hero %}`, `{% callout %}`, `{% demo %}`, etc.). See references/markdoc-tags.md before editing any page.

**API reference is read-only.** Files in `docs-src/api/` are machine-generated. Any manual edit will be overwritten on the next TypeDoc run. To surface changes there, update JSDoc in `src/` instead.
</essential_principles>

<intake>
What do you need to do?

1. **Update after a code change** — `src/`, `index.ts`, or examples have changed and documents need to reflect it
2. **Review consistency** — check that all documents reflect the current source
3. **Update a specific document** — you know exactly which one

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Workflow |
|---|---|
| 1, "code changed", "after change", "just merged", "new feature", "bug fix" | workflows/update-after-change.md |
| 2, "review", "consistency", "check", "audit", "verify" | workflows/consistency-review.md |
| 3, "specific", or names a document | See document routing below |

**Document-specific routing (option 3):**

| Document named | Workflow |
|---|---|
| Any page in `docs-src/pages/` | workflows/update-pages.md |
| `README.md` | workflows/update-readme.md |
| `ARCHITECTURE.md` | workflows/update-architecture.md |
| `CLAUDE.md` | workflows/update-agent-docs.md |
| JSDoc / `src/` | workflows/update-jsdoc.md |

**Intent-based routing (clear intent without selecting a number):**
- "update the components page" / "add example to the data-flow page" → workflows/update-pages.md
- "update README" → workflows/update-readme.md
- "update architecture doc" → workflows/update-architecture.md
- "update CLAUDE.md" / "add non-obvious behavior" → workflows/update-agent-docs.md
- "update JSDoc" / "inline docs" → workflows/update-jsdoc.md
- "review all docs" / "check consistency" → workflows/consistency-review.md

**After identifying the workflow, read it and follow it exactly.**
</routing>

<reference_index>
All in `references/`:

| File | Contents |
|---|---|
| document-map.md | Each document's audience, scope, update triggers, and consistency checks |
| tone-guide.md | Writing tone, register, and conciseness rules per document |
| markdoc-tags.md | Markdoc authoring reference: frontmatter, available tags, and usage patterns |
</reference_index>

<workflows_index>
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| update-after-change.md | Determine which documents to update after a code or example change, then update them |
| update-pages.md | Update narrative pages in `docs-src/pages/` |
| update-readme.md | Update `README.md` |
| update-architecture.md | Update `ARCHITECTURE.md` |
| update-agent-docs.md | Update `CLAUDE.md` |
| update-jsdoc.md | Update JSDoc comments in `src/` |
| consistency-review.md | Review all documents for consistency with current source |
</workflows_index>
