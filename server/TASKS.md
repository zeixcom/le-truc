# Implementation Tasks

Prioritized task list merging the original future-improvements plan with bugs and findings from the [code review report](./REPORT.md) (2026-02-24).

Tasks are ordered so each builds on the previous. A developer can work top-to-bottom within a priority tier. Completed items are marked ✅ and kept for record; remove them in a future cleanup pass once the tier is fully done.

**Testing:** Run `bun run test:server` after each task to catch regressions. New behaviour should include tests — see [TESTS.md](./TESTS.md) for per-module specifications.

---

## P0 — Correctness bugs (fix before any feature work)

These are real bugs with observable wrong behaviour or data-loss risk.

### B-1 — Fix `html-shaping.ts`: regex iterates source but mutates result

**File:** `server/html-shaping.ts:26`

`highlightCodeBlocks` drives a `while`/`exec` loop over `html` (the original string) but calls `result.replace(fullMatch, ...)` to apply changes. When the same code block appears more than once, `String.replace` without a flag replaces **all** occurrences with the first match's output; subsequent iterations then overwrite incorrectly.

**Fix:** Replace the loop with a single `String.replace` call using a global-flag regex and an async replacer, or collect `(fullMatch, replacement)` pairs first, then apply them all to `result` in one pass — keyed by position, not by string value.

The same pattern exists in `effects/pages.ts:34` (`loadIncludes`); fix both together.

**Done when:** A markdown page with two identical fenced code blocks renders both correctly. Existing `html-shaping` tests pass.

---

### B-2 — Fix `file-signals.ts`: use `getRelativePath` in `fullyProcessed`

**File:** `server/file-signals.ts:180–184`

The `fullyProcessed` computed signal strips the `PAGES_DIR` prefix from file paths using string `.replace()`. After `process.chdir()` in `build.ts`, file paths are absolute — neither `./docs-src/pages/` nor `docs-src/pages/` matches, so `relativePath` silently equals the full absolute path. This corrupts output filenames and template variable substitution.

**Fix:** Replace the two-step `.replace()` chain with `getRelativePath(PAGES_DIR, path)`, exactly as the `pageInfos` computed (line 156) already does.

**Done when:** `bun run build:docs` generates `docs/index.html` (not `docs//absolute/path/to/index.html`). Existing page-generation tests pass.

---

### B-3 — Fix `serve.ts`: WebSocket upgrade must not return a Response on success

**File:** `server/serve.ts:243`

`server.upgrade()` hijacks the connection. Returning `new Response()` after a successful upgrade sends a spurious HTTP body alongside the 101 handshake, violating the protocol.

**Fix:** Return `undefined` (i.e. implicit return / no return statement) on the success branch:

```ts
const success = server.upgrade(req, { data: {} })
if (success) return  // ← not new Response()
return new Response('WebSocket upgrade failed', { status: 400 })
```

**Done when:** HMR WebSocket connects cleanly in the browser with no protocol errors in DevTools.

---

### B-4 — Fix `build.ts`: remove timing-based build completion

**File:** `server/build.ts:59–60, 79`

`build()` resolves after two fixed `setTimeout` sleeps (1 s + 0.5 s) regardless of whether effects have finished writing output. `buildOnce()` consequently calls `cleanup()` while effects are still running; the `--build-first` server mode may serve an empty `docs/`.

**Fix:** Effects need to signal completion. The preferred approach given the existing reactive architecture:

1. Each effect returns a Promise that resolves when its first run completes (or rejects on error). Effects that are fire-and-forget async callbacks will need a lightweight completion-signal mechanism — e.g. wrap the `ok` callback so the first invocation resolves an externally held Promise.
2. `build()` awaits `Promise.all([...effectCompletionPromises])` instead of sleeping.
3. Remove both `setTimeout` calls.

This is the most invasive fix in the P0 tier. If a full solution is too disruptive now, a safe intermediate step is to increase the sleep to a value that's reliably long enough in practice and add a `// TODO B-4` comment — but do not ship `buildOnce` to CI with this unfixed.

**Done when:** `bun run build:docs` exits only after all HTML files are present in `docs/`. The "Build completed in Xms" duration reflects actual output time.

---

## P1 — Security

### S-1 — Guard all URL-param-derived paths against directory traversal

**File:** `server/serve.ts:249–268`

`req.params.file`, `req.params.component`, and `req.params.mock` are passed directly to `path.join` / `getFilePath`. A request to `/assets/../../server/config.ts` can escape `ASSETS_DIR`.

**Fix:** After constructing the full path, verify it is contained within the expected root. Use the existing `getRelativePath` logic as the model — it returns `null` when the result starts with `..`. Introduce a `safeFilePath(root, ...parts)` helper in `io.ts` that returns `null` if the resolved path escapes `root`; callers return 404 on `null`.

Apply to every parameterised route:
- `/assets/:file` — root: `ASSETS_DIR`
- `/examples/:component` — root: `EXAMPLES_DIR`
- `/sources/:file` — root: `SOURCES_DIR`
- `/test/:component` — root: `COMPONENTS_DIR`
- `/test/:component/mocks/:mock` — root: `COMPONENTS_DIR`
- `/api/:category/:page` — root: `OUTPUT_DIR/api`

**Done when:** `GET /assets/../../server/config.ts` returns 404, not file contents. Tests added to the serve layer or integration tests.

---

### S-2 — Fix HMR WebSocket URL for HTTPS contexts

**File:** `server/templates/hmr.ts:59`

The client script hardcodes `ws://`, which is blocked as mixed content on HTTPS pages (e.g. when the dev server is reverse-proxied behind TLS).

**Fix:** Replace the hardcoded scheme with a protocol-relative expression inside the generated JS:

```js
const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + ${hostExpression} + '${path}';
```

**Done when:** HMR connects when the server is accessed over HTTPS. Existing HMR template tests updated.

---

## P2 — Design / reliability

### D-1 — Consolidate HMR broadcast to a single API

**File:** `server/build.ts:25–51, 87`

Two parallel APIs exist: `setHMRBroadcast(fn)` (module-level setter) and `build({ hmrBroadcast: fn })` (option). The `'reload'` broadcast on line 87 reads the locally destructured `broadcast` variable, which is `undefined` when `build()` is called from `buildAndWatch()` without passing `hmrBroadcast`. Browsers never receive the post-build reload in that path.

**Fix:** Remove the `hmrBroadcast` option from `build()`. Keep `setHMRBroadcast` as the sole API. Replace all internal `broadcast?.` references with the module-level `hmrBroadcast`. Update `dev.ts` to call `setHMRBroadcast(broadcastToHMRClients)` before `build({ watch: true })`.

**Done when:** `bun run dev` triggers a page reload in the browser after a source file change. `buildAndWatch()` also triggers reload correctly.

---

### D-2 — Replace `execSync` with `Bun.spawn` in CSS and JS effects

**Files:** `server/effects/css.ts:12`, `server/effects/js.ts:14`

`execSync` blocks the entire event loop while LightningCSS and `bun build` run, freezing HMR message delivery and HTTP request handling. `apiEffect` already uses `Bun.spawn` correctly.

**Fix:** Mirror the `apiEffect` pattern: call `Bun.spawn(...)`, `await proc.exited`, check exit code, log error on non-zero. No functional change to the build commands themselves.

**Done when:** The server responds to HTTP requests and can send HMR pings during a CSS or JS rebuild. Manual verification; no new tests required.

---

### D-3 — Replace `process.chdir` with `import.meta.dir`-relative paths in `config.ts`

**File:** `server/build.ts:55–57`, `server/config.ts`

`process.chdir()` inside `build()` is a process-global mutation. It exists only because `config.ts` defines paths with `./` relative to CWD. This silently affects the HTTP server, tests, and any other code sharing the process. It is also the root cause of the path-stripping bug fixed in B-2 (the bug exists because `process.chdir` makes paths absolute while the stripping logic assumes relative).

**Fix:**
1. In `config.ts`, replace all `'./foo'` literals with `join(import.meta.dir, '../foo')` (one level up from `server/`).
2. Remove the `process.chdir` call in `build.ts`.
3. Verify that all downstream consumers of config constants (`file-signals.ts`, effects, `serve.ts`) still resolve to correct absolute paths.

This is a prerequisite for safely parallelising `watchFiles` calls (D-4) and for running server tests without contaminating CWD.

**Done when:** `bun run build:docs` and `bun run dev` work without the `process.chdir`. `bun run test:server` passes with no CWD assumptions.

---

### D-4 — Parallelise `watchFiles` calls in `file-signals.ts`

**File:** `server/file-signals.ts`

All `watchFiles` calls run sequentially (top-level `await`), serialising the initial glob scan across all watched directories. They are independent and can run in parallel.

**Fix:** Group all `watchFiles` calls in a single `Promise.all`. Preserve the `docsMarkdown` IIFE for its pipeline setup but run the IIFE concurrently with the other watchers.

**Done when:** Startup time (measured from process start to first "Watching files" log) is measurably reduced. No test changes needed.

---

### D-5 — Fix layout cache never being cleared in dev mode

**File:** `server/serve.ts:49–71`

`getCachedLayout` populates `layoutsCache` on first use and never evicts entries. `clearLayoutCache()` is exported but has no callers. Editing a layout file during `bun run dev` produces stale responses until the server restarts.

**Fix (choose one — recommend option A):**
- **A (simpler):** Skip the cache entirely when `isDevelopment` is true. The cache is only a performance optimisation; reads are fast during development.
- **B (fuller):** Wire `clearLayoutCache()` into the file watcher callback whenever a file in `LAYOUTS_DIR` changes. This requires the server watcher to know about layout paths, which adds coupling.

Remove the unused `clearLayoutCache` export if option A is chosen.

**Done when:** Editing `docs-src/layouts/page.html` during `bun run dev` reflects in the next page request without restarting the server.

---

## P3 — Documentation corrections

All items in this tier are changes to `SERVER.md` only. Group them into a single commit.

### Doc-1 — Add `mocksEffect` to the Effects table

`mocksEffect` copies `examples/<component>/mocks/**` to `docs/test/`. Add a row to the §Effects table.

### Doc-2 — Add `{% table %}` to the Registered Schemas table

`markdoc.config.ts` registers `table`. Add it to §Markdoc Content System → Registered Schemas.

### Doc-3 — Add `/sources/:file` to the Route Handling table

`serve.ts:257` serves this route. Add it to §HTTP Server → Route Handling.

### Doc-4 — Add `docs/test/` to Build Outputs and Configuration

Add `docs/test/` to the Build Outputs directory tree. Add `TEST_DIR` (`./docs/test`) to the Configuration → Directory Constants table.

### Doc-5 — Correct the "Two Independent File Watchers" section

`setupFileWatcher()` does not exist in `serve.ts`. The server does not run a separate `fs.watch`. Rewrite the section to describe the actual architecture: one watcher in `file-watcher.ts` drives both correctness (reactive rebuilds) and liveness (HMR notifications via `notifyHMR` in `build.ts`).

### Doc-6 — Align `maxReconnectAttempts` default

`hmr.ts` defaults to `5`; the doc says `10`. Change the default in `hmrClient` to `10` to match the injected value and the docs.

### Doc-7 — Remove misleading ✅ from "API Documentation Section"

`effects/pages.ts` does not yet populate `{{ api-category }}`, `{{ api-name }}`, `{{ api-kind }}`, `{{ toc }}` in the `api.html` layout. Move task 1.5 from the old TASKS.md into the active task list as A-1 below, and update the SERVER.md §Future Improvements heading to reflect the partial state.

---

## P3 — Remaining feature work (API section completion)

### A-1 — Populate `api.html` template variables in `pagesEffect`

**File:** `server/effects/pages.ts`

API pages served via direct navigation (`/api/classes/Foo`) use the `api.html` layout, which has `{{ api-category }}`, `{{ api-name }}`, `{{ api-kind }}`, and `{{ toc }}` placeholders. These are not currently populated, leaving breadcrumbs and sidebar TOC empty.

**Fix:** In `applyTemplate`, detect when `layoutName === 'api'` (or when the file's `section === 'api'`). Extract the relevant values from the `ProcessedMarkdownFile` (category from `relativePath`, name and kind from the first H1 heading via a small regex) and add them to the `replacements` map.

**Done when:** Navigating directly to `/api/functions/defineComponent` shows a correct breadcrumb (`Functions > defineComponent`) and a populated sidebar TOC. Lazy-loaded fragments via listnav are unaffected.

---

## P4 — Code quality nits

These are low-risk, low-effort improvements. Batch into one or two PRs.

### N-1 — Type `hmrClients` properly

**File:** `server/serve.ts:43`
Replace `Set<any>` with `Set<import('bun').ServerWebSocket<unknown>>` and remove the `as any` casts in the `open` and `close` handlers.

### N-2 — Iterate `hmrClients` directly in `broadcastToHMRClients`

**File:** `server/serve.ts:180`
`Array.from(hmrClients)` copies the Set on every broadcast call. Use `for (const client of hmrClients)` directly.

### N-3 — Add `recursive` parameter to `watchFiles`

**File:** `server/file-watcher.ts:72`
The `recursive: include.includes('**/')` heuristic is fragile. Add an explicit `recursive?: boolean` parameter to `watchFiles`, defaulting to the current heuristic for backward compat, and update call sites to pass it explicitly.

### N-4 — Remove `highlightCodeBlocks` re-export from `effects/api-pages.ts`

**File:** `server/effects/api-pages.ts:87`
`highlightCodeBlocks` is re-exported from an effects file where it doesn't belong. Update test imports to reference `html-shaping.ts` directly, then remove the re-export.

### N-5 — Comment the `componentMocks` / `componentMarkup` exclude relationship

**File:** `server/file-signals.ts:300–306`
Add a comment explaining that `componentMocks` intentionally watches `**/mocks/**` — the same pattern excluded by `componentMarkup` — so mock files are tracked by their own signal without contaminating markup signals.

---

## Summary — Execution order

| Priority | ID | Task | Status | File(s) |
|---|---|---|---|---|
| 🔴 P0 | B-1 | Fix regex-exec/replace in `html-shaping.ts` + `pages.ts` | ✅ Done | `html-shaping.ts`, `effects/pages.ts` |
| 🔴 P0 | B-2 | Fix path stripping in `file-signals.ts` | ✅ Done | `file-signals.ts` |
| 🔴 P0 | B-3 | Fix WebSocket upgrade response | ✅ Done | `serve.ts` |
| 🔴 P0 | B-4 | Remove timing-based build completion | ✅ Done | `build.ts` |
| 🟠 P1 | S-1 | Guard URL params against path traversal | ✅ Done | `serve.ts`, `io.ts` |
| 🟠 P1 | S-2 | Fix HMR WebSocket URL for HTTPS | ✅ Done | `templates/hmr.ts` |
| 🟡 P2 | D-1 | Consolidate HMR broadcast to single API | ✅ Done | `build.ts`, `dev.ts` |
| 🟡 P2 | D-2 | Replace `execSync` with `Bun.spawn` in CSS/JS effects | ✅ Done | `effects/css.ts`, `effects/js.ts` |
| 🟡 P2 | D-3 | Replace `process.chdir` with `import.meta.dir` paths | ✅ Done | `config.ts`, `build.ts` |
| 🟡 P2 | D-4 | Parallelise `watchFiles` calls | ✅ Done | `file-signals.ts` |
| 🟡 P2 | D-5 | Fix layout cache not cleared in dev mode | ✅ Done | `serve.ts` |
| 🟢 P3 | Doc-1–7 | Correct SERVER.md documentation drift | ✅ Done | `SERVER.md` |
| 🟢 P3 | A-1 | Populate `api.html` template variables | ✅ Done | `effects/pages.ts` |
| ⚪ P4 | N-1–5 | Code quality nits | ✅ Done | Various |

**Previously completed (record only):**

| ✅ | API signal enabled (`apiMarkdown`) | `file-signals.ts` |
|---|---|---|
| ✅ | API listnav index generation (`apiEffect`) | `effects/api.ts` |
| ✅ | API server routes | `serve.ts` |
| ✅ | API Markdown pipeline (`apiPagesEffect`) | `effects/api-pages.ts` |
| ✅ | `apiPagesEffect` registered in build orchestrator | `build.ts` |
| ✅ | Incremental TypeDoc (hash-based skip + `Bun.spawn`) | `effects/api.ts` |

---

## Backlog

Features deferred from the current implementation scope. Revisit when the P0–P3 work is stable.

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
