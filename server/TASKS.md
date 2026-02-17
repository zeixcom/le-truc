# Implementation Tasks — Future Improvements

Prioritized task list derived from [SERVER.md § Future Improvements](./SERVER.md#future-improvements). Tasks are grouped by feature and ordered so each task builds on the previous one. A developer can work through them top-to-bottom.

**Testing:** A test suite is in place (`server/__tests__/`) with P0 coverage of core modules (276 tests). The circular dependency between `markdoc-helpers.ts` and schema files has been resolved by extracting shared constants to `markdoc-constants.ts`. New features should include tests — see [TESTS.md](./TESTS.md) for specifications and [SERVER.md § Testing](./SERVER.md#testing-server__tests__) for an overview.

---

## 1 · API Documentation Section

The TypeDoc pipeline already generates Markdown into `docs-src/api/` (functions, classes, type-aliases, variables), but these files are never rendered into the docs site. The goal is to surface them as a navigable "/api" section using the existing `api.html` layout and the `{% listnav %}` pattern from the Examples page.

### 1.1 — Enable the `apiMarkdown` file signal

**File:** `server/file-signals.ts`

- Uncomment the `apiMarkdown` signal and its `watchFiles(API_DIR, '**/*.md')` call.
- Uncomment the import of `API_DIR` from `config`.
- Export `apiMarkdown` so effects can depend on it.

**Done when:** `apiMarkdown.sources` reactively lists every `.md` file under `docs-src/api/`.

---

### 1.2 — Generate a listnav-compatible API index in `apiEffect`

**File:** `server/effects/api.ts`

After TypeDoc finishes, scan `docs-src/api/` and build a structured index (grouped by category: Functions, Classes, Type Aliases, Variables) that can be consumed by a `{% listnav %}` tag. Two options — pick whichever is simpler:

- **Option A — Generate `docs-src/pages/api.md` automatically.** Write a Markdown file with frontmatter (`title`, `emoji`, `layout: page`) and a `{% listnav %}` block whose list items link to `/api/<category>/<name>.html`. Model the structure on `docs-src/pages/examples.md`.
- **Option B — Generate a JSON/HTML index file** (e.g. `docs-src/includes/api-nav.html`) that `api.md` can `{{ include }}`.

Reference `docs-src/api/globals.md` — TypeDoc already produces a grouped listing there that can be parsed to extract entry names and categories.

**Done when:** A valid `api.md` (or equivalent) exists after every `apiEffect` run, with grouped listnav entries for all API symbols.

---

### 1.3 — Add server routes for nested API paths

**File:** `server/serve.ts`

The current `/:page` route only handles top-level pages. API pages live at `/api/<category>/<name>.html`. Add routes:

```text
/api/:category/:page   →  docs/api/<category>/<page>   (handleStaticFile)
/api/:page             →  docs/api/<page>               (handleStaticFile, for api index)
```

Place these **before** the catch-all `/:page` route so they take precedence.

**Done when:** Requests to e.g. `/api/functions/defineComponent.html` serve the built HTML file (once it exists from task 1.5).

---

### 1.4 — Process API Markdown through the Markdoc pipeline

**File:** `server/file-signals.ts` (and potentially a new `server/effects/api-pages.ts`)

Individual API Markdown files in `docs-src/api/**/*.md` need to go through the same parse → transform → render → Shiki highlighting → post-processing pipeline that `docsMarkdown.fullyProcessed` uses.

Decide between:

- **Extending `docsMarkdown`** to also watch `docs-src/api/` (broader change, reuses all existing logic).
- **Creating a parallel `apiPages` signal** with its own processing memo/task, keeping the two pipelines independent (safer, avoids side-effects on existing pages).

Either way, the processing must:

1. Strip TypeDoc navigation breadcrumbs above the first `# heading` (the existing `section === 'api'` logic already does this — reuse it).
2. Parse/validate/transform/render with Markdoc + Shiki.
3. Pass results to a page-generation effect (task 1.5).

**Done when:** Each `docs-src/api/**/*.md` file is processed into a `ProcessedMarkdownFile` with its `htmlContent` populated.

---

### 1.5 — Populate `api.html` template variables and write API pages

**File:** `server/effects/pages.ts` (extend `applyTemplate`) or a new `server/effects/api-pages.ts`

The `api.html` layout expects these template variables that `applyTemplate` does not currently set:

| Variable | Source |
|---|---|
| `{{ api-category }}` | Directory name: `functions`, `classes`, `type-aliases`, `variables` |
| `{{ api-name }}` | Symbol name extracted from the `# heading` (strip `Function:` / `Type Alias:` etc. prefix) |
| `{{ api-kind }}` | Kind string: `function`, `class`, `type-alias`, `variable` |
| `{{ toc }}` | Auto-generated table-of-contents HTML from `<h2>`/`<h3>` headings in the rendered content |

Extend the `replacements` map in `applyTemplate` (or a new API-specific template function) to provide these values. Write the final HTML to `docs/<relativePath>.html` (e.g. `docs/api/functions/defineComponent.html`).

**Done when:** Running `bun run build:docs` produces HTML files under `docs/api/` that render correctly with breadcrumbs, sidebar TOC, and API-specific styling.

---

### 1.6 — Register `apiPagesEffect` in the build orchestrator

**File:** `server/build.ts`

- Import and call the new effect (if a separate `api-pages.ts` was created in 1.4/1.5).
- Wire its cleanup into the returned cleanup function.
- Ensure it runs **after** `apiEffect` (it depends on `apiMarkdown.sources` which depend on TypeDoc output).

**Done when:** `bun run build:docs` and `bun run dev` both generate the full API section end-to-end.

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

**Done when:** `{% faq %}{% question %}…{% /question %}{% /faq %}` parses, validates, and renders to accessible HTML. Tests added to `server/__tests__/schema/faq.test.ts`.

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

### 3.1 — Incremental TypeDoc

**File:** `server/effects/api.ts`

**Problem:** `apiEffect` runs `typedoc` via `execSync` on every library source change, regenerating all API docs from scratch.

**Approach:**

1. Investigate TypeDoc's `--watch` mode or its programmatic API (`Application.convert()` + `Application.generateDocs()`) for incremental output.
2. If TypeDoc doesn't support true incremental generation, consider **diffing** the source change set (from `libraryScripts.sources`) and only regenerating docs for changed files. TypeDoc's `--entryPoints` flag can target individual files.
3. As a simpler first step, **skip the TypeDoc run** when no `.ts` files under `src/` have actually changed (compare hashes from the file signal).

**Done when:** Editing a single file in `src/` no longer triggers a full TypeDoc regeneration (or at least short-circuits when nothing meaningful changed).

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

| Priority | Task | Effort | Prerequisite | Tests |
|---|---|---|---|---|
| 🔴 P0 | 1.1 Enable `apiMarkdown` signal | S | — | `file-signals.test.ts` |
| 🔴 P0 | 1.2 Generate listnav API index | M | 1.1 | `effects/api.test.ts` |
| 🔴 P0 | 1.3 Add API server routes | S | — | `serve.test.ts` |
| 🔴 P0 | 1.4 Process API Markdown through pipeline | L | 1.1 | `file-signals.test.ts` |
| 🔴 P0 | 1.5 Populate `api.html` template variables | M | 1.4 | `effects/pages.test.ts` |
| 🔴 P0 | 1.6 Register effect in build orchestrator | S | 1.4, 1.5 | `build.test.ts` |
| 🟡 P1 | 2.2 Create FAQ Markdoc schema | M | — | `schema/faq.test.ts` |
| 🟡 P1 | 2.3 Register FAQ schema | S | 2.2 | — |
| 🟡 P1 | 2.4 Create FAQ page | S | 2.3 | — |
| 🟡 P1 | 2.5 Add FAQ to page ordering | S | 2.4 | `config.test.ts` |
| 🟢 P2 | 3.1 Incremental TypeDoc | M | 1.6 | `effects/api.test.ts` |
| 🟢 P2 | 3.2 Parallel effect execution | M | — | `build.test.ts` |
| 🟢 P2 | 3.3 Improved error overlay | M | — | `templates/hmr.test.ts` |

**Effort key:** S = small (< 1 hr), M = medium (1–3 hrs), L = large (3+ hrs)

**Testing note:** Run `bun run test:server` after each task to verify no regressions. See [TESTS.md](./TESTS.md) for detailed test specifications per module.