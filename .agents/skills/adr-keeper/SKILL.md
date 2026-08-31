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
**Immutability is about breaking changes, not publication.** An ADR is "published" once it has landed on `main` (check with `git show main:adr/000X-....md`). Before publication, an ADR is still in-flight: amend it directly in place, in any section, including folding in amendments or rewriting Decision/Alternatives/Consequences — nobody outside the branch has seen it yet. After publication, a **non-breaking** edit (a clarification, a factual fix, or an additive extension that leaves the original decision and its defaults intact) is still edited in place; only a **breaking** change (one that reverses, contradicts, or materially changes what was decided) requires a new ADR that supersedes it, per the supersede workflow. See workflows/update-adr.md for the breaking/non-breaking checklist. This keeps the decision history stable and free of number inflation for edits nobody needs a diff to understand, while still forcing a new record when the ground truth actually changes under someone who was relying on it.

**Trace to requirements.** Every ADR must reference relevant sections from REQUIREMENTS.md (e.g., M1, S3, X1).

**Sequential numbering.** ADRs use 4-digit sequential numbers (0001, 0002, ...).

**Status is explicit.** Each ADR must have a clear status: Proposed, Accepted, Rejected, Superseded.

**Concise over comprehensive.** Focus on the decision, context, and consequences. Avoid unnecessary detail.

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

<reference_index>
All in `references/`:

| File | Contents |
|---|---|
| adr-template.md | The template for new ADRs |
| adr-index.md | Index of all ADRs with status |
</reference_index>

<workflows_index>
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| create-adr.md | Create a new ADR from the template |
| update-adr.md | Update an ADR — in place if unpublished, or if published and the change is non-breaking |
| list-adr.md | List all ADRs, optionally filtered by keyword |
| supersede-adr.md | Create a new ADR that supersedes an existing one, for a breaking change |
</workflows_index>
