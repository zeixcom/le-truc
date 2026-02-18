# Implementation Tasks — Future Improvements

Prioritized task list derived from [SERVER.md § Future Improvements](./SERVER.md#future-improvements). Tasks are grouped by feature and ordered so each task builds on the previous one. A developer can work through them top-to-bottom.

**Testing:** A test suite is in place (`server/tests/`) with P0 coverage of core modules. The circular dependency between `markdoc-helpers.ts` and schema files has been resolved by extracting shared constants to `markdoc-constants.ts`. New features should include tests — see [TESTS.md](./TESTS.md) for specifications and [SERVER.md § Testing](./SERVER.md#testing-servertests) for an overview.

---

## 1 · API Documentation Section ✅

The API section is fully implemented. TypeDoc generates Markdown into `docs-src/api/`, which is processed through a dedicated pipeline and served as lazy-loaded HTML fragments via the listnav navigation pattern.

### 1.1 — Enable the `apiMarkdown` file signal ✅

**File:** `server/file-signals.ts` — `apiMarkdown` signal enabled, watches `docs-src/api/**/*.md`, exported.

### 1.2 — Generate a listnav-compatible API index in `apiEffect` ✅

**File:** `server/effects/api.ts` — Chose Option A: `apiEffect` parses `globals.md`, generates `docs-src/pages/api.md` with grouped `{% listnav %}` entries (Classes, Type Aliases, Variables, Functions).

### 1.3 — Add server routes for nested API paths ✅

**File:** `server/serve.ts` — Route `/api/:category/:page` added before the `/:page` catch-all. Serves HTML fragments from `docs/api/<category>/<page>`.

### 1.4 — Process API Markdown through the Markdoc pipeline ✅

**File:** `server/effects/api-pages.ts` (new file) — Separate pipeline: strips TypeDoc breadcrumbs, parses/validates/transforms with Markdoc, highlights code blocks with Shiki, post-processes HTML, rewrites cross-reference links to hash anchors. Outputs HTML fragments (no full page wrapper) for lazy-loading by `module-lazyload`.

### 1.5 — Populate `api.html` template variables and write API pages ⚠️ Partial

**File:** `server/effects/api-pages.ts` — API pages are written as HTML fragments to `docs/api/<category>/<name>.html`. The `api.html` layout template variables (`{{ api-category }}`, `{{ api-name }}`, `{{ api-kind }}`, `{{ toc }}`) are **not yet populated** in `effects/pages.ts`. This only affects direct navigation to API pages (breadcrumbs and sidebar TOC are empty); lazy-loaded fragments via listnav work correctly.

### 1.6 — Register `apiPagesEffect` in the build orchestrator ✅

**File:** `server/build.ts` — `apiPagesEffect` imported, registered after `apiEffect`, cleanup wired into the returned cleanup function.

---

## 2 · FAQ Section

### 2.1 — Decide on rendering approach

Before writing code, choose one of:

- **Custom Markdoc schema** (`{% faq %}` / `{% question %}` tags) → renders to `<details><summary>` elements. More structured, validates content.
- **Native `<details>` in Markdown** → no schema needed, but no validation or custom styling hooks.
- **Custom component** (`<module-faq>`) → more work, but interactive (search, filter, deep-link).

Recommendation: start with a **custom Markdoc schema** for consistency with the existing tag library. It can always render to plain `<details><summary>` without a client-side component.

---

### 2.2 — Create `faq.markdoc.ts` schema

**File:** `server/schema/faq.markdoc.ts`

Define two tags:

| Tag | Renders as | Attributes |
|---|---|---|
| `{% faq %}` | `<div class="faq">` (wrapper) | `class`, `id` |
| `{% question %}` | `<details><summary>…</summary>…</details>` | `open` (boolean, default false) |

The `{% question %}` tag should:

- Use the **first child paragraph** (or an explicit `title` attribute) as the `<summary>` text.
- Render remaining children as the `<details>` body.
- Generate an `id` from the summary text (via `generateSlug` from `markdoc-helpers.ts`) for anchor linking.

Reference `server/schema/callout.markdoc.ts` for the pattern of extracting child content and rendering to a custom element. Import shared attribute definitions from `markdoc-constants.ts` (not `markdoc-helpers.ts`) to avoid circular dependencies.

**Done when:** `{% faq %}{% question %}…{% /question %}{% /faq %}` parses, validates, and renders to accessible HTML. Tests added to `server/tests/schema/faq.test.ts`.

---

### 2.3 — Register the FAQ schema in Markdoc config

**File:** `server/markdoc.config.ts`

- Import `faq` and `question` from `./schema/faq.markdoc`.
- Add both to the `tags` object.

---

### 2.4 — Create `docs-src/pages/faq.md`

**File:** `docs-src/pages/faq.md`

Write an initial FAQ page with frontmatter (`title: 'FAQ'`, `emoji: '❓'`, `layout: 'page'`) and a few starter questions grouped by topic (e.g. "Getting Started", "Components", "Reactivity"). Use anchor links for direct linking.

---

### 2.5 — Add `faq` to page ordering

**File:** `server/config.ts`

Add `'faq'` to the `PAGE_ORDER` array (after `'api'` or `'about'`, depending on desired nav position).

**Done when:** `bun run build:docs` generates `docs/faq.html` and it appears in the navigation menu.

---

## 3 · Developer Experience

### 3.1 — Incremental TypeDoc ✅

**File:** `server/effects/api.ts`

**Implemented:** Hash-based skip — `computeSourcesHash` computes a composite SHA-256 hash of all library source file hashes (sorted for order-independence). The hash is compared to the previous successful run; if unchanged, TypeDoc is skipped entirely. Additionally, the `execSync` call was replaced with `Bun.spawn` so TypeDoc runs asynchronously, unblocking the event loop for other effects.

**Done when:** ~~Editing a single file in `src/` no longer triggers a full TypeDoc regeneration.~~ ✅ Implemented.

---

### 3.2 — Parallel effect execution

**File:** `server/build.ts`

**Problem:** Effects are registered sequentially. Independent effects block each other unnecessarily.

**Approach:**

Identify effects with independent dependency graphs and run them concurrently:

| Group | Effects | Shared dependency |
|---|---|---|
| API | `apiEffect` | `libraryScripts` |
| Styles | `cssEffect` | `docsStyles`, `componentStyles` |
| Scripts | `jsEffect` | `docsScripts`, `libraryScripts`, `componentScripts` |
| Content | `pagesEffect`, `menuEffect`, `sitemapEffect` | `docsMarkdown` |
| Examples | `examplesEffect`, `sourcesEffect` | `componentMarkdown`, `componentMarkup` |
| Infra | `serviceWorkerEffect` | all style + script sources |

Effects within different groups can be initialized in parallel (e.g. using `Promise.all` for any async init work). The reactive system already handles execution ordering at runtime through signal dependencies, so the main gain is in **initial build** where multiple independent effects can kick off simultaneously.

Wrap independent groups in `Promise.all`:

```text
await Promise.all([
  apiEffect(),
  cssEffect(),
  jsEffect(),
])
// then effects that depend on the above
```

**Done when:** `bun run build:docs` completes measurably faster (benchmark before/after).

---

### 3.3 — Improved HMR error overlay

**File:** `server/templates/hmr.ts`

**Problem:** The build error overlay is a plain unstyled `<div>` with no dismiss button, no file/line info, and no structure.

**Improvements:**

1. **Structured layout** — header bar with "Build Error" title + dismiss (×) button, scrollable body with monospace error text.
2. **File/line info** — Parse the error message for file paths and line numbers. Display them as a clickable breadcrumb (or at minimum, visually highlighted).
3. **Dismiss functionality** — Add a close button that removes the overlay. Store dismissal in `sessionStorage` so it doesn't reappear for the same error until the next build attempt.
4. **Styling** — Use a `<dialog>` element or a fixed overlay with a semi-transparent backdrop instead of a plain `<div>` pushed into `document.body`.

Keep the overlay self-contained (inline styles + no external dependencies) since it's injected as a raw script.

**Done when:** Build errors display in a dismissible, readable overlay with file path information.

---

## Summary — Suggested execution order

| Priority | Task | Status | Tests |
|---|---|---|---|
| 🔴 P0 | 1.1 Enable `apiMarkdown` signal | ✅ Done | `effects/api.test.ts` |
| 🔴 P0 | 1.2 Generate listnav API index | ✅ Done | `effects/api.test.ts` |
| 🔴 P0 | 1.3 Add API server routes | ✅ Done | — |
| 🔴 P0 | 1.4 Process API Markdown through pipeline | ✅ Done | `effects/api-pages.test.ts` |
| 🔴 P0 | 1.5 Populate `api.html` template variables | ⚠️ Partial | — |
| 🔴 P0 | 1.6 Register effect in build orchestrator | ✅ Done | — |
| 🟡 P1 | 2.2 Create FAQ Markdoc schema | Pending | `schema/faq.test.ts` |
| 🟡 P1 | 2.3 Register FAQ schema | Pending | — |
| 🟡 P1 | 2.4 Create FAQ page | Pending | — |
| 🟡 P1 | 2.5 Add FAQ to page ordering | Pending | `config.test.ts` |
| 🟢 P2 | 3.1 Incremental TypeDoc | ✅ Done | `effects/api.test.ts` |
| 🟢 P2 | 3.2 Parallel effect execution | Pending | `build.test.ts` |
| 🟢 P2 | 3.3 Improved error overlay | Pending | `templates/hmr.test.ts` |

**Testing note:** Run `bun run test:server` after each task to verify no regressions. See [TESTS.md](./TESTS.md) for detailed test specifications per module.
