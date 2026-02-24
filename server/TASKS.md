# Implementation Tasks

Prioritized task list for `server/`. All P0–P4 correctness, security, design, and documentation tasks from the 2026-02-24 code review are complete. The current iteration focuses on filling test gaps identified against [TESTS.md](./TESTS.md).

**Testing:** Run `bun run test:server` after each task to catch regressions. See [TESTS.md](./TESTS.md) for per-module specifications.

---

## P0 — Missing tests: pure functions and critical routes

These test files cover modules with high regression risk and are straightforward to write.

### T-1 — Add `config.test.ts`

**File:** `server/tests/config.test.ts`

TESTS.md §2. All tests are pure constant-checks with no I/O.

- `PAGE_ORDER` contains all known pages and has no duplicates
- `ROUTE_LAYOUT_MAP` maps API sub-paths to `"api"` and has a default `"/"` → `"page"` fallback
- Directory constants are all absolute paths (now that D-3 is done; the plan says "relative" but they are now absolute from `import.meta.dir`)
- `MIME_TYPES` covers all served extensions: `html`, `css`, `js`, `json`, `svg`, `woff2`

---

### T-2 — Add `serve.test.ts`

**File:** `server/tests/serve.test.ts`

TESTS.md §14. Start an isolated server on a random port with minimal fixture files. Use `NODE_ENV=production` by default; test HMR injection with `NODE_ENV=development`.

Focus on the highest-value cases first:
- Route responses: §14.1 cases 1–8, 13–14 (skip WebSocket-dependent cases for now)
- Path traversal: `GET /assets/../../server/config.ts` → 404 (regression guard for S-1)
- HMR injection: §14.3 cases 1–3 (inject in dev, omit in production, leave non-HTML alone)
- Layout selection: §14.4 cases 2–4 (test `getLayoutForPath` directly as a unit function)

The WebSocket upgrade and broadcast tests (§14.5) may be added as follow-up if isolation is difficult.

---

### T-3 — Add `templates/menu.test.ts` and `templates/sitemap.test.ts`

**Files:** `server/tests/templates/menu.test.ts`, `server/tests/templates/sitemap.test.ts`

TESTS.md §4 and §5. These are pure functions over mock data — no I/O required.

**`menu.test.ts`:** §4 cases 1–5 — renders `<li>`, wraps in `<section-menu>`, sorts by `PAGE_ORDER`, filters section pages, handles empty input.

**`sitemap.test.ts`:** §5 cases 1–7 — `<url>` structure, correct priorities for home/root/default pages, valid XML, correct `xmlns`.

---

## P1 — Missing tests: Markdoc schemas

### T-4 — Add `schema/callout.test.ts`, `schema/hero.test.ts`, `schema/demo.test.ts`

**Files:** `server/tests/schema/callout.test.ts`, `.../hero.test.ts`, `.../demo.test.ts`

TESTS.md §11.3–11.5. These use the same `parseMarkdocToHtml` helper pattern as the existing schema tests.

**`callout.test.ts`:** §11.3 cases 1–4 — `card-callout` element, valid class values, default class, children.

**`hero.test.ts`:** §11.4 cases 1–4 — `section-hero` element, H1 extraction, `hero-layout` div structure, hero with only title.

**`demo.test.ts`:** §11.5 cases 1–4 — `module-demo` element, HR-separated preview/content, fence-based demo, markdown after separator.

---

### T-5 — Add `schema/section.test.ts` and `schema/carousel.test.ts`

**Files:** `server/tests/schema/section.test.ts`, `.../carousel.test.ts`

TESTS.md §11.7–11.8. Lower priority but straightforward.

**`section.test.ts`:** §11.8 cases 1–3 — renders `<section>`, passes `class` attribute, renders children.

**`carousel.test.ts`:** §11.7 cases 1–3 — renders `module-carousel`, prev/next buttons, `role="tablist"`.

---

### T-6 — Complete `templates/fragments.test.ts`

**File:** `server/tests/templates/fragments.test.ts`

Currently only 2 basic tests exist. TESTS.md §6 specifies 10 cases.

Add missing cases:
- `tabButton` ARIA attributes: `role="tab"`, `aria-controls`, `aria-selected`, `tabindex`
- `tabPanel` structure: `role="tabpanel"`, `hidden` attribute for non-selected
- `tabGroup` structure: `tablist` div, panel divs, fallback message for empty panels
- `validatePanels`: rejects empty array, multiple selected, duplicate types

Also add a regression test: `tabPanel` with pre-rendered HTML content (`panel.content` containing `<code>` tags) is passed through unescaped via `raw()`.

---

### T-7 — Add `markdoc-helpers.test.ts` §10.5 — Markdoc `html()` tagged template literal

**File:** `server/tests/markdoc-helpers.test.ts` (add to existing file)

TESTS.md §10.5. The Markdoc-version `html` tagged template (in `markdoc-helpers.ts`) is distinct from the plain-string `html` in `templates/utils.ts`. Tests §10.5 cases 1–7 are missing.

- Single element → returns `Tag`
- Nested elements → correct children
- Attributes are parsed
- String interpolation in children
- Array interpolation flattens
- Self-closing elements work
- Invalid HTML returns error callout

---

## P2 — Missing tests: file pipeline and effects

### T-8 — Add `file-signals.test.ts`

**File:** `server/tests/file-signals.test.ts`

TESTS.md §12. The `extractFrontmatter` function should be exported (or a thin `__extractFrontmatter` export added for testing) to allow unit testing.

- **§12.1 Frontmatter unit tests** (9 cases) — title, all fields, `order` as int, `draft` as bool, `tags` as array, empty metadata, quote stripping, content without frontmatter, malformed frontmatter
- **§12.2 Pipeline integration tests** (5 cases) — require temp files; verify `processed` map size, `pageInfos` URL/section/title derivation
- **§12.3 `fullyProcessed` integration** (8 cases) — HTML output, API section stripping, `depth`/`basePath` calculation, template variable extraction

---

### T-9 — Add `file-watcher.test.ts`

**File:** `server/tests/file-watcher.test.ts`

TESTS.md §13. Set `PLAYWRIGHT=1` to prevent real `fs.watch` from activating; test scanning behavior only.

- §13 cases 1–7: initial scan count, `exclude` glob, empty dir, non-existent dir, `FileInfo` field correctness, recursive glob, Playwright detection

---

### T-10 — Complete `effects/examples.test.ts` and `effects/sources.test.ts`

**Files:** `server/tests/effects/examples.test.ts`, `server/tests/effects/sources.test.ts`

Both exist but are significantly incomplete.

**`examples.test.ts`** (currently 2/5 cases): add TESTS.md §16.4 cases 2–5 — skip without HTML file, skip non-matching markdown, `{{ content }}` replacement, Markdoc tag processing.

**`sources.test.ts`** (currently 2/6 cases): add TESTS.md §16.5 cases 1–6 — tab group generation per component, HTML/CSS/TS panel presence, last-panel selection, filename matching.

---

### T-11 — Add `effects/pages.test.ts`, `effects/menu.test.ts`, `effects/sitemap.test.ts`

**Files:** `server/tests/effects/pages.test.ts`, `.../menu.test.ts`, `.../sitemap.test.ts`

TESTS.md §16.1–16.3. Integration tests with temp directories and overridden config paths.

**`pages.test.ts`:** §16.1 cases 1–9 — HTML file per markdown, layout selection, content/title/hash/include replacement, unknown variables silently empty.

**`menu.test.ts`:** §16.2 cases 1–5 — writes `menu.html`, `<section-menu>` root, section pages filtered, sorted by `PAGE_ORDER`, no-op on empty input.

**`sitemap.test.ts`:** §16.3 cases 1–4 — writes `sitemap.xml`, valid XML, one `<url>` per page, home page priority.

---

### T-12 — Add remaining template and effect tests

**Files:** `templates/hmr.test.ts`, `templates/service-worker.test.ts`, `templates/performance-hints.test.ts`, `effects/service-worker.test.ts`

TESTS.md §7, §8, §9, §16.6. Lower priority; batch into one task.

**`hmr.test.ts`:** §9 cases 1–8 — IIFE, `/ws` path, reconnect logic, `maxReconnectAttempts`, error overlay functions, `__HMR__`, logging disable, `<script>` wrapper.

**`service-worker.test.ts`:** §8 cases 1–7 — `CACHE_NAME`, versioned asset URLs, event listeners, `minifiedServiceWorker` strips `console.log`, `validateServiceWorkerConfig`.

**`performance-hints.test.ts`:** §7 cases 1–5 — `<link rel="preload">`, `as` attribute, `crossorigin` for fonts, empty array, multiple links.

**`effects/service-worker.test.ts`:** §16.6 cases 1–4 — writes `sw.js`, hashes in `CACHE_NAME`, install and fetch listeners.

---

### T-13 — Add `build.test.ts`

**File:** `server/tests/build.test.ts`

TESTS.md §15. Integration tests that verify orchestration logic with mocked effects.

Note: TESTS.md §15 case 4 says "process.cwd() ends with project root after call" — this is now stale since D-3 removed `process.chdir`. Update the test to verify that `build()` does NOT call `process.chdir` (or simply remove that case).

Key cases:
- `build()` returns a cleanup function
- Cleanup calls all effect cleanups
- `build({ watch: false })` resolves without hanging
- `build({ watch: true })` sends `build-success` via HMR broadcast
- Build error in watch mode sends `build-error`
- All registered effects are called

---

## Summary — Execution order

| Priority | ID | Task | Status |
|---|---|---|---|
| 🔴 P0 | T-1 | `config.test.ts` | Pending |
| 🔴 P0 | T-2 | `serve.test.ts` | Pending |
| 🔴 P0 | T-3 | `menu.test.ts`, `sitemap.test.ts` templates | Pending |
| 🟠 P1 | T-4 | `callout`, `hero`, `demo` schema tests | Pending |
| 🟠 P1 | T-5 | `section`, `carousel` schema tests | Pending |
| 🟠 P1 | T-6 | Complete `fragments.test.ts` | Pending |
| 🟠 P1 | T-7 | Markdoc `html()` template literal tests | Pending |
| 🟡 P2 | T-8 | `file-signals.test.ts` | Pending |
| 🟡 P2 | T-9 | `file-watcher.test.ts` | Pending |
| 🟡 P2 | T-10 | Complete `examples.test.ts`, `sources.test.ts` | Pending |
| 🟡 P2 | T-11 | `effects/pages`, `effects/menu`, `effects/sitemap` | Pending |
| 🟢 P3 | T-12 | `hmr`, `service-worker`, `performance-hints` templates + `effects/service-worker` | Pending |
| 🟢 P3 | T-13 | `build.test.ts` | Pending |

---

## Backlog

Features deferred from the current implementation scope. Revisit when the test suite is substantially complete.

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
