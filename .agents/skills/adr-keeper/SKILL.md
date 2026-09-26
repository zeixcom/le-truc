---
name: adr-keeper
description: Maintains Architectural Decision Records (ADRs) for the le-truc project. Creates, updates, lists, and supersedes ADRs in the /adr/ directory.
user_invocable: true
---

<scope>
This skill manages the **Architectural Decision Record (ADR) process** for @zeix/le-truc:

- Create new ADRs from templates
- Update existing ADRs — freely pre-publication; in place for non-breaking edits once published; via supersession only for breaking changes (see immutability principle below)
- List all ADRs with status
- Supersede published ADRs with breaking decisions
- Maintain the ADR index

**In scope:** All files in `/adr/` directory
**Out of scope:** REQUIREMENTS.md, ARCHITECTURE.md (use architect skill)
</scope>

<essential_principles>
**Immutability is about breaking changes, not publication.** An ADR is "published" once it has landed on `main` (check with `git show main:adr/000X-....md`). Before publication, an ADR is still in-flight: amend it directly in place, in any section, including folding in amendments or rewriting Decision/Alternatives/Consequences — nobody outside the branch has seen it yet. After publication, a **non-breaking** edit (a clarification, a factual fix, or an additive extension that leaves the original decision and its defaults intact) is still edited in place; only a **breaking** change (one that reverses, contradicts, or materially changes what was decided) requires a new ADR that supersedes it, per the supersede workflow. At a major-version milestone, published ADRs may also be reworded and purged of implementation detail to meet the current style — the course stays; only the telling changes. See workflows/update-adr.md for the breaking/non-breaking checklist. This keeps the decision history stable and free of number inflation for edits nobody needs a diff to understand, while still forcing a new record when the ground truth actually changes under someone who was relying on it.

**Trace to requirements.** Every ADR must reference relevant sections from REQUIREMENTS.md (e.g., M1, S3, X1).

**Sequential numbering.** ADRs use 4-digit sequential numbers (0001, 0002, ...).

**Status is explicit.** Each ADR must have a clear status: Proposed, Accepted, Rejected, Superseded.

**ADRs record timeless reasoning, not implementation.** An ADR states the problem, the commitment, the rejected alternatives and why, and the lasting tradeoffs. It must stay true after the code is refactored. Content that tracks the code lives elsewhere, and the ADR links to it:

| Content | Where it lives |
|---|---|
| Ticket numbers (`LT-NNN`), iteration plans, shape-exploration rounds | `BACKLOG.md` / `TODO.md` / `DONE.md` and commit messages — never in an ADR |
| Reference tables that drift (diagnostic codes, option lists, per-surface or per-file matrices) | A living document — `ARCHITECTURE.md`, `server/compiler/HOST_PROFILE.md`, JSDoc — or the source constant itself |
| Code examples for public interfaces | JSDoc and examples in source; the ADR names the key file (for example `src/component.ts`) |
| Implementation mechanics (internals, file layout, step-by-step algorithms) | Source code and `ARCHITECTURE.md` |

Keep a snippet only when the decision itself is a syntax or a shape that prose cannot state, and keep it to a few lines.

**Hard budget: 1500 words and 100 lines per ADR.** Check with `wc -lw adr/NNNN-*.md` before you finish a create or an update. Over budget means detail that belongs elsewhere: move it out per the table above; do not compress the reasoning. If the reasoning alone exceeds the budget, the ADR holds more than one decision — split it.

**Amendments replace, they do not accumulate.** Each round of shape exploration folds into the existing sections and removes the text it makes obsolete. The ADR records where the design landed, not the route there.

**Length lives in the rationales — cut there first.** Context: a few tight sentences stating the problem, plus links to REQUIREMENTS.md / ARCHITECTURE.md — links, not history. Decision: the commitment and its mechanism, no design narrative; numbered sub-designs only when the decision has multiple genuine moving parts. Consequences: compact Good/Bad lists. No appended war-story postscripts — a hard-won lesson that matters long-term is promoted to `ARCHITECTURE.md` or its own ADR, not indented into an old one.
</essential_principles>

<intake>
What would you like to do with ADRs?

1. **Create** a new ADR
2. **Update** an existing ADR (in place if unpublished, or if published and the change is non-breaking — see update-adr.md)
3. **List** all ADRs
4. **Supersede** a published ADR with a breaking change
5. **Search** ADRs by keyword

Wait for response before proceeding.
</intake>

<routing>
| Response | Workflow |
|---|---|
| 1, "create", "new", "add" | workflows/create-adr.md |
| 2, "update", "edit", "modify" | workflows/update-adr.md |
| 3, "list", "show all", "index" | workflows/list-adr.md |
| 4, "supersede", "replace", "deprecate" | workflows/supersede-adr.md |
| 5, "search", "find", "grep" | workflows/list-adr.md (with filter) |

**Intent-based routing:**
- "I want to document a decision" → workflows/create-adr.md
- "ADR 0005 needs a fix" → workflows/update-adr.md
- "Show me all ADRs" → workflows/list-adr.md
- "ADR 0002 is obsolete" → workflows/supersede-adr.md
- "Find ADRs about reactivity" → workflows/list-adr.md
</routing>

<file_locations>
The skill's data files live in `/adr/`, not under this skill — `adr/` stays writable in sandboxes that deny writes to `.agents/`:

| File | Contents |
|---|---|
| `/adr/adr-index.md` | Index of all ADRs with status |
| `/adr/0000-template.md` | The template for new ADRs |
</file_locations>

<workflows_index>
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| create-adr.md | Create a new ADR from the template |
| update-adr.md | Update an ADR — in place if unpublished, or if published and the change is non-breaking |
| list-adr.md | List all ADRs, optionally filtered by keyword |
| supersede-adr.md | Create a new ADR that supersedes an existing one, for a breaking change |
</workflows_index>
