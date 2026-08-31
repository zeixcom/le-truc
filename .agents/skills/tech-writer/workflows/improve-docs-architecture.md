# Improve Docs Architecture

Restructure the guide: split or merge pages, improve navigation, add interactive teaching components. This skill plans the restructure, executes the content work itself, and routes pipeline work to `docs-server-dev` through the Architect's `TODO.md`/`NOTES.md` protocol.

Triggered by: "docs are too long", "split this page", "merge pages", "improve navigation", "add a teaching component", "restructure the guide".

## Step 1: Read context

1. `references/document-map.md` — current page inventory, audiences, scopes
2. `references/tone-guide.md` → Text Types — the classification each page/section runs on
3. `server/SERVER.md` — Guide Chapters section and every effect that consumes page structure (menu, pages, examples, llms-full-manifest, sitemap)
4. `PAGE_ORDER` and `CHAPTERS` in `server/config.ts`
5. `.agents/skills/architect/SKILL.md` `<todo_format>` and `<notes_format>` — the coordination protocol this workflow speaks

## Step 2: Audit the docs architecture

Collect signals; do not propose fixes yet.

**Page signals:**
- Length vs. chapter siblings. A page at roughly double the chapter median is a split candidate. Two pages that always cross-link and share an audience are merge candidates.
- H2 count. The in-page TOC renders only at two or more H2s. A page with one H2, or with H3s doing H2 work, is misshapen.
- Text types fighting inside one page — explanation, reference, and tutorial sections with different audiences sharing one URL.
- Orphaned or poorly reachable content (e.g., blog posts beyond the three newest are absent from the index).

**Navigation signals:**
- Chapter fit: every page belongs to exactly one chapter, in a reading order a newcomer can follow.
- The reader's path: `getting-started` → first chapter part 1 → … → `examples`/`api`. Breaks in that path are restructure candidates.
- Cross-links: which internal anchors move if pages split or merge.

**Demo signals:**
- Concept pages where interaction would teach better than prose (lifecycle, reconciliation, async states).
- Demos that exist but do not isolate the concept they sit under.

## Step 3: Present candidates

Numbered list. For each candidate:

```markdown
### Candidate N: Brief description
- **Pages**: `components.md`, new `props.md`, …
- **Problem**: which audit signal fires, and how it hurts the reader
- **Solution**: plain English — what moves where, what merges, what is new
- **Benefits**: for the reader — journey, discoverability — not for the maintainers
- **Pipeline needs**: what the docs pipeline must gain (chapter grouping, stepper, template variable, Markdoc tag)
- **Handoffs**: docs-server-dev tasks, ADR candidates, follow-up tasks in other domains
```

**Language rules:**
- Use `CONTEXT.md` vocabulary and the glossary below.
- Present candidates, then stop. Ask: "Which of these would you like to pursue?" Do not execute before the user picks.

## Step 4: Plan the restructure

Decide before touching files:

1. **URL policy.** Flat URLs. Existing URLs keep working unless the user explicitly approves breaking them — subdirectories break routing, `{% sources %}` paths, and the llms-full manifest.
2. **Chapter assignment.** `CHAPTERS` membership and `PAGE_ORDER` position for every page.
3. **Anchor migration.** Grep every internal anchor that moves; list every referencer to update.
4. **Owner split.** Every piece of work gets exactly one owner:

   **tech-writer executes:** page prose, link repair, `README.md` docs list, document-map entries, and declarative config edits (`PAGE_ORDER`, `CHAPTERS` membership, `CURATED_PAGES`).

   **docs-server-dev executes** (TODO.md `LT-NNN` task): any pipeline *code* — effects, templates, schemas, routes, template variables, Markdoc tags. Write the task so no design decisions are left open: behavior, acceptance criteria, files involved. Pattern from `architect/workflows/architecture.md` Step 7.

   ```markdown
   - [ ] LT-NNN: Brief task title
     **Skill:** docs-server-dev
     **Context:** What to build and why (1–3 sentences). Include acceptance
     criteria and the files involved. The developer must not need to make
     design decisions.
   ```

   **ADR-worthy decisions:** apply architect's three criteria — hard to reverse, surprising without context, real trade-off. URL structure and chapter layout qualify. Invoke the `adr-keeper` skill directly with the gathered context (pattern from `architect/workflows/record-adr.md` Step 4). Status 🔄 Proposed unless the user confirms Accepted.

   **Follow-ups in other domains:** TODO.md tasks with the right `**Skill:**` (`le-truc-dev` for example-component review, `architect` for REQUIREMENTS/ARCHITECTURE fallout).

   **Mid-work escalation:** if blocked or a deviation is needed, append to `NOTES.md` in the architect's format and stop that piece of work until resolved:

   ```markdown
   ---

   ## LT-NNN — Brief challenge title
   **Date:** YYYY-MM-DD | **Skill:** tech-writer
   **Issue:** the unexpected challenge or proposed deviation
   **Options:** (a) … (b) …
   **Question:** what Architect or user must resolve
   ```

## Step 5: Interactive teaching components

- **Progressive enhancement is the rule.** The page teaches fully without the component; the component only demonstrates. No concept may live only in the interactive.
- **One interactive per page at most.**
- **Contract:** the component lives in `examples/<type>/<dir>/` named `<type>-<dir>`; it needs the component files (`.ts`, `.html`, `.css`), a `<name>.md` doc — the examples effect skips components without one — and a Playwright spec served at `http://localhost:3000/test/<name>`.
- **Reference implementations:** `examples/docs/lifecycle/docs-lifecycle` (connect/disconnect log), `examples/docs/reconcile/docs-reconcile` (keyed list with surviving row state).
- Component code is `examples/` territory. Spec it in the restructure plan, build it alongside the page, and flag substantial components for `le-truc-dev` review via a TODO.md task (`— done, pending review ⏳` with the Changed/How/Check handoff).

## Step 6: Execute and verify

1. Execute the tech-writer-owned work; keep every URL unless the user approved breaking it.
2. When docs-server-dev lands a pipeline task, update the declarative config, regenerate the menu (the build does), and repair links.
3. Verify:
   - `bun run build:docs` green
   - `bun test server/tests` green
   - Link grep clean — no anchors to nowhere
   - Browser click-through of every changed page, menu group, chapter stepper, and demo
4. Update document-map entries for every page added, removed, or renamed.

## Step 7: Close out

- Add a **Skill changes** CHANGELOG entry if this skill's files changed, following the `changelog-keeper` conventions.
- Update TODO.md statuses per the Post-Task Protocol in `SKILL.md`.
- Report: what changed, what was handed off, what remains open.

## Glossary (use these terms exactly)

- **Chapter** — a named group of guide pages sharing one learning goal (`CHAPTERS` in `server/config.ts`)
- **Page** — one flat URL under `docs-src/pages/`
- **Text type** — the tone-guide classification of a section (Landing, Tutorial, How-to, Explanation, Reference, AI-optimized, Narrative, Community)
- **Teaching component** — an interactive example embedded in a page to demonstrate one concept
- **Progressive enhancement** — the page teaches fully without the interactive
- **Navigation layer** — menu grouping, chapter stepper, cross-links

## Success Criteria

- Candidates presented before execution; user selected one
- Every existing URL still resolves unless the user approved breaking it
- No TODO task requires docs-server-dev to make design decisions
- ADR-worthy structure decisions recorded as ADRs
- document-map, `README.md`, `PAGE_ORDER`, `CHAPTERS`, `CURATED_PAGES` consistent with the new structure
- `bun run build:docs` and `bun test server/tests` green; browser click-through done
