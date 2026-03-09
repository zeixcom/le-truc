# Implementation Tasks

Prioritized task list for `server/`. All P0–P4 correctness, security, design, and documentation tasks from the 2026-02-24 code review are complete, as are all testing tasks (T-1–T-13). See [TESTS.md](./TESTS.md) for the current test strategy and conventions.

**Testing:** Run `bun run test:server` after each change to catch regressions.

---

## Backlog

Features deferred from the current implementation scope. Revisit when needed.

### FAQ Section

Add a FAQ page with collapsible question/answer blocks.

**Approach:** Custom Markdoc schema (`{% faq %}` / `{% question %}`) rendering to `<details><summary>` elements is recommended for consistency with the existing tag library. Native `<details>` in plain Markdown is an acceptable lower-effort alternative.

**When ready, implement:**
1. `server/schema/faq.markdoc.ts` — `{% faq %}` wrapper + `{% question %}` tag (extracts first paragraph as `<summary>`, generates slug-based `id` for anchor linking). Reference `callout.markdoc.ts` for the child-extraction pattern. Import attribute definitions from `markdoc-constants.ts`.
2. Register `faq` (and `question` if separate) in `server/markdoc.config.ts`.
3. Create `docs-src/pages/faq.md` with frontmatter and starter questions grouped by topic.
4. Add `'faq'` to `PAGE_ORDER` in `server/config.ts`.
5. Tests in `server/tests/schema/faq.test.ts`.

### Improved HMR error overlay

The current overlay is a plain `<div>` with no dismiss button, no file/line info, and no structure.

**When ready, implement in `server/templates/hmr.ts`:**
- Structured layout: header + dismiss (×) button + scrollable monospace body.
- Parse error message for file paths and line numbers; highlight them visually.
- Dismiss stores acknowledgement in `sessionStorage` so the same error doesn't reappear until the next build attempt.
- Consider using `<dialog>` or a backdrop `<div>` instead of a body-prepended element.
- Keep self-contained (inline styles, no external deps).
