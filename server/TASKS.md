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

---

## Previously completed (record only)

### Testing tasks (T-1–T-13)

| | Task | File(s) |
|---|---|---|
| ✅ | T-1: `config.test.ts` | `server/tests/config.test.ts` |
| ✅ | T-2: `serve.test.ts` | `server/tests/serve.test.ts` |
| ✅ | T-3: `templates/menu.test.ts`, `templates/sitemap.test.ts` | `server/tests/templates/menu.test.ts`, `sitemap.test.ts` |
| ✅ | T-4: `schema/callout.test.ts`, `schema/hero.test.ts`, `schema/demo.test.ts` | `server/tests/schema/callout.test.ts`, `hero.test.ts`, `demo.test.ts` |
| ✅ | T-5: `schema/section.test.ts`, `schema/carousel.test.ts` | `server/tests/schema/section.test.ts`, `carousel.test.ts` |
| ✅ | T-6: Complete `templates/fragments.test.ts` | `server/tests/templates/fragments.test.ts` |
| ✅ | T-7: Markdoc `html()` template literal tests | `server/tests/markdoc-helpers.test.ts` |
| ✅ | T-8: `file-signals.test.ts` | `server/tests/file-signals.test.ts` |
| ✅ | T-9: `file-watcher.test.ts` | `server/tests/file-watcher.test.ts` |
| ✅ | T-10: Complete `effects/examples.test.ts`, `effects/sources.test.ts` | `server/tests/effects/examples.test.ts`, `sources.test.ts` |
| ✅ | T-11: `effects/pages.test.ts`, `effects/menu.test.ts`, `effects/sitemap.test.ts` | `server/tests/effects/pages.test.ts`, `menu.test.ts`, `sitemap.test.ts` |
| ✅ | T-12: `templates/hmr.test.ts`, `templates/service-worker.test.ts`, `templates/performance-hints.test.ts`, `effects/service-worker.test.ts` | `server/tests/templates/hmr.test.ts`, `service-worker.test.ts`, `performance-hints.test.ts`, `effects/service-worker.test.ts` |
| ✅ | T-13: `build.test.ts` | `server/tests/build.test.ts` |

### 2026-02-24 — Code review fixes (P0–P4)

| | Task | File(s) |
|---|---|---|
| ✅ | B-1: Fix regex-exec/replace in `html-shaping.ts` + `pages.ts` | `html-shaping.ts`, `effects/pages.ts` |
| ✅ | B-2: Fix path stripping in `file-signals.ts` | `file-signals.ts` |
| ✅ | B-3: Fix WebSocket upgrade returns `Response` | `serve.ts` |
| ✅ | B-4: Remove timing-based build completion | `build.ts` |
| ✅ | S-1: Guard URL params against path traversal | `serve.ts`, `io.ts` |
| ✅ | S-2: Fix HMR WebSocket URL for HTTPS | `templates/hmr.ts` |
| ✅ | D-1: Consolidate HMR broadcast to single API | `build.ts`, `dev.ts` |
| ✅ | D-2: Replace `execSync` with `Bun.spawn` in CSS/JS effects | `effects/css.ts`, `effects/js.ts` |
| ✅ | D-3: Replace `process.chdir` with `import.meta.dir` paths | `config.ts`, `build.ts` |
| ✅ | D-4: Parallelise `watchFiles` calls | `file-signals.ts` |
| ✅ | D-5: Fix layout cache not cleared in dev mode | `serve.ts` |
| ✅ | Doc-1–7: Correct SERVER.md documentation drift | `SERVER.md` |
| ✅ | A-1: Populate `api.html` template variables | `effects/pages.ts` |
| ✅ | N-1: Type `hmrClients` as `ServerWebSocket<unknown>` | `serve.ts` |
| ✅ | N-2: Iterate `hmrClients` directly in broadcast | `serve.ts` |
| ✅ | N-3: Add `recursive` parameter to `watchFiles` | `file-watcher.ts` |
| ✅ | N-4: Remove `highlightCodeBlocks` re-export from `api-pages.ts` | `effects/api-pages.ts` |
| ✅ | N-5: Comment `componentMocks`/`componentMarkup` exclude relationship | `file-signals.ts` |
| ✅ | `isDevelopment` check: `!== 'production'` → `=== 'development'` | `serve.ts` |
| ✅ | `html`/`xml` templates: escape strings by default; add `raw()`/`RawHtml` | `templates/utils.ts`, `templates/fragments.ts` |

### Pre-review completions

| | Task | File(s) |
|---|---|---|
| ✅ | API signal enabled (`apiMarkdown`) | `file-signals.ts` |
| ✅ | API listnav index generation (`apiEffect`) | `effects/api.ts` |
| ✅ | API server routes | `serve.ts` |
| ✅ | API Markdown pipeline (`apiPagesEffect`) | `effects/api-pages.ts` |
| ✅ | `apiPagesEffect` registered in build orchestrator | `build.ts` |
| ✅ | Incremental TypeDoc (hash-based skip + `Bun.spawn`) | `effects/api.ts` |