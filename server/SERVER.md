# Server & Build System

The Le Truc development server and build system provide a unified solution for documentation generation, component development, and testing — with integrated Hot Module Replacement (HMR) for live reloading.

## Quick Start

```bash
bun run dev              # Development server with HMR + file watching
bun run serve            # Serve pre-built content (no HMR)
bun run serve:docs       # Build docs, then serve
bun run serve:examples   # Build examples, then serve (Playwright-safe)
bun run build:docs       # One-shot docs build
bun run test             # Run all Playwright tests
bun run test:component <name>  # Run tests for a single component
bun run test:server      # Run server unit/integration tests
```

## Architecture Overview

The system has two cooperating halves — a **reactive build pipeline** and an **HTTP/WebSocket server** — stitched together by `dev.ts` for development.

```
┌──────────────────────────────────────────────────────────────────────┐
│  dev.ts  (entry point for `bun run dev`)                             │
│  ┌──────────────────────┐    ┌─────────────────────────────────────┐ │
│  │  build.ts            │    │  serve.ts                           │ │
│  │  (reactive pipeline) │───▶│  (HTTP + WebSocket server)          │ │
│  │                      │    │                                     │ │
│  │  file-signals.ts     │    │  Routes: /, /api/status, /assets/*, │ │
│  │  file-watcher.ts     │    │  /examples/*, /test/*, /:page, /ws  │ │
│  │  effects/*           │    │                                     │ │
│  └──────────────────────┘    └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### How `dev.ts` Wires Them Together

1. Imports `serve.ts` — which starts `Bun.serve()` as a side-effect on import
2. Passes `broadcastToHMRClients` from `serve.ts` directly as `hmrBroadcast` to `build()`
3. Calls `build({ watch: true, hmrBroadcast })` to start the reactive pipeline with file watching
4. Handles `SIGINT`/`SIGTERM` for graceful shutdown

## Scripts Reference

| Script | Command | HMR | Watch | Build First |
|--------|---------|-----|-------|-------------|
| `dev` | `NODE_ENV=development bun --watch server/dev.ts` | Yes | Yes | Yes |
| `serve` | `bun server/serve.ts` | No | No | No |
| `serve:docs` | `bun server/serve.ts --build-first` | No | No | Yes |
| `serve:examples` | `bun run build:examples && PLAYWRIGHT=1 bun server/serve.ts` | No | No | Yes |
| `build:docs` | `bun ./server/build.ts` | N/A | No | N/A |
| `build:docs:watch` | `bun ./server/build.ts --watch` | N/A | Yes | N/A |
| `build:examples` | `bun run build:examples:js && bun run build:examples:css` | N/A | No | N/A |
| `test` | `bunx playwright test examples` | N/A | N/A | N/A |
| `test:component` | `bun scripts/test-component.ts <name>` | N/A | N/A | N/A |
| `test:server` | `bun test server/tests` | N/A | N/A | N/A |
| `test:server:watch` | `bun test server/tests --watch` | N/A | N/A | N/A |

## Reactive Build Pipeline

### Core Primitives

The build system is powered by `@zeix/cause-effect` reactive signals:

- **`file-watcher.ts`** — `watchFiles(directory, include, exclude?)` creates a reactive `List<FileInfo>` backed by `Bun.Glob` scanning. Under non-Playwright conditions, attaches `fs.watch` for incremental updates via the `watched` option of `createList`.
- **`file-signals.ts`** — Defines all source signals and the Markdoc processing pipeline.
- **`build.ts`** — Orchestrates effects; forwards HMR notifications via `options.hmrBroadcast`.

### File Signals

Each signal is a reactive `List<FileInfo>` that updates when files are added, changed, or removed.

| Signal | Watches | Extensions | Recursive |
|--------|---------|------------|-----------|
| `docsMarkdown.sources` | `docs-src/pages/` | `.md` | Yes |
| `docsStyles.sources` | `docs-src/` | `.css` | No |
| `docsScripts.sources` | `docs-src/` | `.ts` | No |
| `templateScripts.sources` | `server/templates/` | `.ts` | Yes |
| `libraryScripts.sources` | `src/` | `.ts` | Yes |
| `componentMarkup.sources` | `examples/` (excl. `mocks/`) | `.html` | Yes |
| `componentMarkdown.sources` | `examples/` | `.md` | Yes |
| `componentStyles.sources` | `examples/` | `.css` | Yes |
| `componentScripts.sources` | `examples/` | `.ts` | Yes |

The `docsMarkdown` signal has a multi-stage pipeline:

```
sources (List<FileInfo>)
  → processed (Memo: frontmatter extraction, metadata)
  → pageInfos (Memo: page navigation data for menu/sitemap)
  → fullyProcessed (Task: Markdoc parse → transform → render → Shiki highlighting → post-processing)
```

### Effects

Each effect factory calls `createEffect(() => match([...signals], { ok, err }))` and returns `{ cleanup: Cleanup, ready: Promise<void> }`. `ready` resolves after the first `ok`/`err` handler completes; `build()` awaits all `ready` promises to know when the initial build is done.

| Effect | Depends On | Output | Tool |
|--------|-----------|--------|------|
| `apiEffect` | `libraryScripts.sources` | `docs-src/api/**/*.md`, `docs-src/pages/api.md` | TypeDoc + typedoc-plugin-markdown |
| `apiPagesEffect` | `apiMarkdown.sources` | `docs/api/**/*.html` | Markdoc + Shiki (HTML fragments) |
| `cssEffect` | `docsStyles`, `componentStyles` | `docs/assets/main.css` | LightningCSS (`bunx lightningcss`) |
| `jsEffect` | `docsScripts`, `libraryScripts`, `componentScripts` | `docs/assets/main.js` + sourcemap | `bun build` |
| `serviceWorkerEffect` | All style + script sources | `docs/sw.js` | Template generation |
| `examplesEffect` | `componentMarkdown`, `componentMarkup` | `docs/examples/<name>.html` | Markdoc + Shiki |
| `mocksEffect` | `componentMocks.sources` | `docs/test/<component>/mocks/*` | File copy |
| `sourcesEffect` | `componentMarkup`, `componentStyles`, `componentScripts` | `docs/sources/<name>.html` | Shiki-highlighted tab groups |
| `pagesEffect` | `docsMarkdown.fullyProcessed` | `docs/**/*.html` | Layout templating |
| `menuEffect` | `docsMarkdown.pageInfos` | `docs-src/includes/menu.html` | Template generation |
| `sitemapEffect` | `docsMarkdown.pageInfos` | `docs/sitemap.xml` | XML template |

### Build Outputs

```
docs/
├── api/
│   ├── classes/           # API class fragments
│   ├── functions/         # API function fragments
│   ├── type-aliases/      # API type alias fragments
│   └── variables/         # API variable fragments
├── assets/
│   ├── main.css          # Minified CSS bundle
│   └── main.js           # Minified JS bundle + sourcemap
├── examples/
│   └── <name>.html       # Pre-built example pages
├── sources/
│   └── <name>.html       # Syntax-highlighted source tab groups
├── test/
│   └── <component>/mocks/ # Copied mock files for component tests
├── <page>.html           # Documentation pages
├── sw.js                 # Service worker
└── sitemap.xml           # SEO sitemap
docs-src/
├── api/                  # TypeDoc-generated Markdown (intermediate)
│   ├── classes/
│   ├── functions/
│   ├── type-aliases/
│   └── variables/
└── includes/
    └── menu.html         # Generated navigation menu (intermediate)
```

## Markdoc Content System

### Processing Pipeline

Markdown files in `docs-src/pages/` are processed through:

1. **Frontmatter extraction** — Custom YAML mini-parser strips `title`, `emoji`, `description`, `layout`, etc.
2. **Markdoc parse/validate/transform** — Using registered schemas from `markdoc.config.ts`
3. **Markdoc render to HTML** — Produces raw HTML string
4. **Shiki syntax highlighting** — Code blocks highlighted with Monokai theme
5. **Final HTML shaping** — schema-driven link handling and `module-demo` preview HTML injection
6. **Layout application** — `docs-src/layouts/page.html` with `{{ include }}` and `{{ variable }}` substitution

### Registered Schemas

Configured in `markdoc.config.ts`:

**Node overrides:** `fence`, `heading`

**Tags:**

| Tag | Renders As | Description |
|-----|-----------|-------------|
| `{% callout %}` | `<card-callout>` | Styled callout boxes (`.info`, `.tip`, `.danger`, `.note`, `.caution`) |
| `{% carousel %}` | `<module-carousel>` | Interactive carousel with slides, tablist, prev/next buttons |
| `{% slide %}` | `<div>` | Individual carousel slide (used inside `carousel`) |
| `{% demo %}` | `<module-demo>` | Interactive demo: raw HTML preview + Markdown description |
| `{% listnav %}` | `<module-listnav>` | Sidebar list navigation with lazy-loaded content panel |
| `{% sources %}` | `<details>` | Lazy-loaded source code viewer |
| `{% section %}` | `<section>` | Styled content section |
| `{% hero %}` | `<section-hero>` | Hero section with extracted heading and TOC placeholder |
| `{% tabgroup %}` | `<module-tabgroup>` | ARIA-compliant tabbed content |
| `{% table %}` | `<table>` | Markdown table with optional caption |
| `{% blogmeta %}` | `<card-blogmeta>` | Blog post publication metadata (date, author, avatar, reading time) — self-closing |
| `{% blogpost %}` | `<card-blogpost>` | Blog excerpt card wrapping a heading (linked) and optional description |

Note: `link.markdoc.ts` is registered as a node override in `markdoc.config.ts` and handles local `.md` → `.html` link conversion during Markdoc transform.

### Markdoc Constants

`markdoc-constants.ts` provides shared constants and attribute definitions used by all Markdoc schemas. It was extracted from `markdoc-helpers.ts` to avoid circular dependencies between helpers and schema files.

- **Attribute classes:** `ClassAttribute`, `IdAttribute`, `CalloutClassAttribute` — custom Markdoc attribute types with `validate()` and `transform()` methods
- **Attribute definitions:** `classAttribute`, `idAttribute`, `styleAttribute`, `titleAttribute`, `requiredTitleAttribute`, `commonAttributes`, `styledAttributes`
- **Children definitions:** `standardChildren`, `richChildren`

### Markdoc Helpers

`markdoc-helpers.ts` provides shared utilities for schema development:

- **Node utilities:** `extractTextFromNode()`, `transformChildrenWithConfig()`, `splitContentBySeparator()`
- **HTML generation:** `createNavigationButton()`, `createTabButton()`, `createAccessibleHeading()`, `createVisuallyHiddenHeading()`
- **`html` tagged template literal** — A mini HTML parser that converts HTML strings to Markdoc `Tag` objects (distinct from the plain-string `html` in `templates/utils.ts`)

### Code Block Features

The `fence` schema override provides:
- Syntax highlighting via Shiki (Monokai theme)
- Copy button with success/error feedback
- Language label and optional filename (`lang#filename` syntax)
- Auto-collapse for blocks exceeding 10 lines
- Code stored in `data-code` attribute for async highlighting

## HTTP Server (`serve.ts`)

### Route Handling

| Route | Serves | Source |
|-------|--------|--------|
| `GET /` | Home page | `docs/index.html` |
| `GET /api/status` | Health check (`"OK"`) | Inline |
| `GET /ws` | WebSocket upgrade (HMR) | In-memory |
| `GET /api/:category/:page` | API doc fragment | `docs/api/<category>/<page>` |
| `GET /assets/:file` | Static assets | `docs/assets/` |
| `GET /examples/:component` | Pre-built example HTML | `docs/examples/` |
| `GET /sources/:file` | Source code fragments | `docs/sources/` |
| `GET /test/:component/mocks/:mock` | Test mock files | `examples/<component>/mocks/` |
| `GET /test/:component` | Component test page | `docs-src/layouts/test.html` + `examples/<component>/<component>.html` |
| `GET /blog/:slug` | Individual blog post | `docs/blog/<slug>.html` |
| `GET /:page` | Documentation page | `docs/<page>.html` |
| `GET /favicon.ico` | Favicon | `docs/favicon.ico` |

All HTML routes support `Accept: text/markdown` to return raw `.md` source from `docs-src/pages/`.

### Layout and Template System

Layouts live in `docs-src/layouts/`:

| Layout | Used For |
|--------|----------|
| `page.html` | Standard documentation pages |
| `overview.html` | Overview/index pages |
| `api.html` | API reference pages |
| `blog.html` | Blog posts |
| `example.html` | Example component pages |
| `test.html` | Component test harness |

Templates use `{{ variable }}` substitution and `{{ include 'file' }}` directives (resolved from `docs-src/includes/`).

Layout files are cached in a `Map<string, string>` in `serve.ts` for performance. In development mode the cache is bypassed so layout changes take effect immediately without a server restart.

### Static File Handling

The `handleStaticFile` function:
- Checks file existence before serving
- Returns proper 404 for missing files
- Injects HMR script in development mode for HTML responses
- Handles MIME types from `config.ts` `MIME_TYPES` map
- Supports Brotli/Gzip compression via `getCompressedBuffer()` from `io.ts`

### Port and Startup

- Default port: 3000 (configurable in `SERVER_CONFIG`)
- Port conflict detection: hits `/api/status` on startup; exits with `lsof` hint if occupied
- CLI flags: `--mode docs`, `--build-first`, `--help`

## Hot Module Replacement (HMR)

### Components

| Component | File | Role |
|-----------|------|------|
| WebSocket server | `serve.ts` | Manages client connections, broadcasts messages via `broadcastToHMRClients()` |
| Build integration | `build.ts` `options.hmrBroadcast` | Calls the broadcast function passed in from `dev.ts` on build success/error |
| Client script | `templates/hmr.ts` | Browser-side WebSocket client, injected into HTML |

### Message Protocol

**Server → Client:**
```
"reload"                                        // Trigger page reload
{"type": "build-success"}                       // Build completed
{"type": "build-error", "message": "..."}       // Build failed
{"type": "file-changed", "path": "src/foo.ts"}  // File changed
{"type": "pong"}                                // Keep-alive response
```

**Client → Server:**
```
{"type": "ping"}                                // Keep-alive request
```

### Client Configuration

```typescript
hmrScriptTag({
  enableLogging: true,          // Console logging
  maxReconnectAttempts: 10,     // Reconnection limit
  reconnectInterval: 1000,      // Base reconnect delay (ms)
  pingInterval: 30000,          // Keep-alive interval (ms)
})
```

### Client Features

- Auto-reconnection with exponential backoff
- Build error overlay injected into `document.body`
- `visibilitychange` reconnection (reconnects when tab becomes active)
- `window.__HMR__` debug API: `.status()`, `.reconnect()`, `.disconnect()`
- Conditional injection: only when `NODE_ENV=development` and `!PLAYWRIGHT`

## Template System (`server/templates/`)

| File | Exports | Used By |
|------|---------|---------|
| `utils.ts` | `html`, `xml`, `css`, `js` tagged template literals; `raw()` / `RawHtml` for pre-rendered content; `escapeHtml`, `escapeXml`, `generateSlug`, `createOrderedSort`, validation helpers | All templates |
| `constants.ts` | `MIME_TYPES`, `RESOURCE_TYPE_MAP`, `PAGE_ORDER`, `SERVICE_WORKER_EVENTS`, `SITEMAP_PRIORITIES`, etc. | Config, templates |
| `fragments.ts` | `tabButton`, `tabPanel`, `tabGroup`, `componentInfo` | `sourcesEffect` |
| `hmr.ts` | `hmrClient()`, `hmrScriptTag()` | `serve.ts` |
| `menu.ts` | `menuItem()`, `menu()` | `menuEffect` |
| `performance-hints.ts` | `preloadLink()`, `performanceHints()` | `pagesEffect` |
| `service-worker.ts` | `serviceWorker()`, `minifiedServiceWorker()` | `serviceWorkerEffect` |
| `sitemap.ts` | `sitemapUrl()`, `sitemap()` | `sitemapEffect` |

Note: `templates/utils.ts` `html` produces **plain HTML strings**; `markdoc-helpers.ts` `html` produces **Markdoc `Tag` objects**. They are different functions imported from different paths.

## Testing (`server/tests/`)

The server has a test suite using **Bun's built-in test runner** (`bun:test`). Tests live in `server/tests/` and mirror the source module structure.

### Running Tests

| Script | Command | Description |
|--------|---------|-------------|
| `test:server` | `bun test server/tests` | Run all server tests |
| `test:server:unit` | `bun test server/tests --bail` | Run with bail on first failure |
| `test:server:integration` | `bun test server/tests --timeout 10000` | Run with longer timeout |
| `test:server:watch` | `bun test server/tests --watch` | Watch mode for development |

### Test Structure

```
server/tests/
├── helpers/
│   └── test-utils.ts              # Shared utilities (temp dirs, mocks, assertions)
├── effects/
│   ├── api-pages.test.ts          # stripBreadcrumbs, highlightCodeBlocks
│   ├── api.test.ts                # parseGlobals, generateApiIndexMarkdown, sortCategories
│   ├── blog-pages.test.ts         # getBlogVariables, generateBlogExcerpts, computeBlogPrevNext
│   ├── examples.test.ts           # processExample
│   ├── mocks.test.ts              # getMockOutputPath
│   └── sources.test.ts            # generatePanels
├── io.test.ts                     # IO utilities
├── markdoc-constants.test.ts      # Attribute classes and constant definitions
├── markdoc-helpers.test.ts        # Node utilities, tag helpers, post-processing
├── schema/
│   ├── fence.test.ts              # Code block schema
│   ├── heading.test.ts            # Heading schema
│   ├── listnav.test.ts            # Listnav schema
│   ├── sources.test.ts            # Sources schema
│   └── table.test.ts              # Table schema
└── templates/
    ├── fragments.test.ts           # Tab group fragments
    └── utils.test.ts              # Tagged template literals, escaping, validation
```

### Test Categories

| Category | Mocking | File I/O | Network | Typical runtime |
|----------|---------|----------|---------|-----------------|
| **Unit** | None | No | No | < 5 ms per test |
| **Integration** | Minimal | Temp dirs | No | < 500 ms per test |
| **Server** | Build pipeline | Temp dirs | localhost HTTP | < 2 s per test |

### Current Coverage

| Test file | Module |
|-----------|--------|
| `io.test.ts` | File hashing, paths, compression, safe writes |
| `templates/utils.test.ts` | Tagged templates, escaping, slugs, sorting, validation |
| `templates/fragments.test.ts` | Tab group fragment generation |
| `schema/fence.test.ts` | Code block transformation pipeline |
| `schema/heading.test.ts` | Heading levels, anchors, ID generation |
| `schema/listnav.test.ts` | Listnav schema rendering |
| `schema/sources.test.ts` | Sources schema rendering |
| `schema/table.test.ts` | Table schema rendering |
| `markdoc-helpers.test.ts` | Node utilities, tag helpers, post-processing |
| `markdoc-constants.test.ts` | Attribute classes, constant definitions |
| `effects/api-pages.test.ts` | `stripBreadcrumbs`, `highlightCodeBlocks` |
| `effects/api.test.ts` | `parseGlobals`, `generateApiIndexMarkdown`, `sortCategories` |
| `effects/blog-pages.test.ts` | `getBlogVariables`, `generateBlogExcerpts`, `computeBlogPrevNext` |
| `effects/examples.test.ts` | `processExample` |
| `effects/mocks.test.ts` | `getMockOutputPath` |
| `effects/sources.test.ts` | `generatePanels` |

**Total:** ~373 tests, ~700 ms execution time.

### Test Helpers

`server/tests/helpers/test-utils.ts` provides shared utilities:

- **Temp directories:** `createTempDir()`, `createTempFile()`, `createTempStructure()`
- **Mock generators:** `mockMarkdown()`, `mockHtml()`, `mockFileInfo()`, `mockRequestContext()`
- **Assertions:** `assertContains()`, `assertNotContains()`, `assertMatches()`, `assertValidHtml()`
- **Async:** `wait()`, `retryUntil()`
- **Normalization:** `normalizeWhitespace()`, `normalizeHtml()`

### References

- [TESTS.md](./TESTS.md) — Full test plan with specifications for all modules
- [TEST-SUMMARY.md](./TEST-SUMMARY.md) — Implementation progress and resolved issues
- [tests/README.md](./tests/README.md) — Test usage guidelines

## Configuration (`config.ts`)

### Directory Constants

All path constants are **absolute paths** computed from `ROOT = join(import.meta.dir, '..')` at module load time, so the server never needs to `process.chdir`.

| Constant | Path (relative to project root) | Description |
|----------|--------------------------------|-------------|
| `ROOT` | `.` | Project root (absolute) |
| `SRC_DIR` | `src/` | Library source |
| `COMPONENTS_DIR` | `examples/` | Component examples |
| `CSS_FILE` | `examples/main.css` | CSS entry point |
| `TS_FILE` | `examples/main.ts` | JS entry point |
| `TEMPLATES_DIR` | `server/templates/` | Template functions |
| `INPUT_DIR` | `docs-src/` | Documentation source root |
| `PAGES_DIR` | `docs-src/pages/` | Markdown pages |
| `API_DIR` | `docs-src/api/` | TypeDoc output (intermediate) |
| `LAYOUTS_DIR` | `docs-src/layouts/` | HTML layout templates |
| `INCLUDES_DIR` | `docs-src/includes/` | Includable HTML fragments |
| `MENU_FILE` | `docs-src/includes/menu.html` | Generated menu |
| `OUTPUT_DIR` | `docs/` | Final build output |
| `ASSETS_DIR` | `docs/assets/` | Built assets |
| `BLOG_OUTPUT_DIR` | `docs/blog/` | Built blog post HTML pages |
| `EXAMPLES_DIR` | `docs/examples/` | Built example pages |
| `SOURCES_DIR` | `docs/sources/` | Highlighted source fragments |
| `TEST_DIR` | `docs/test/` | Copied mock files for component tests |

### Page Ordering

`PAGE_ORDER` controls navigation menu order:
`index`, `getting-started`, `components`, `styling`, `data-flow`, `examples`, `api`, `blog`, `about`

## Environment Variables

| Variable | Values | Effect |
|----------|--------|--------|
| `NODE_ENV` | `development` | Enables HMR, file watching, debug features |
| | `production` / unset | Disables HMR, production-like serving |
| `PLAYWRIGHT` | `1` | Disables HMR even in development; prevents WebSocket connections and script injection |
| `DEBUG` | `1` | Verbose logging for file watching and build events |

## Troubleshooting

**HMR not working:** Check `NODE_ENV=development` is set. Look for `__HMR__` messages in browser console. Verify WebSocket connection to `/ws`.

**Tests failing with HMR interference:** Verify `PLAYWRIGHT=1` is set. The `serve:examples` script sets this automatically.

**Build errors during development:** Errors display as an overlay in the browser. Check server console for full details. File watching continues after failures.

**Port conflict:** The server checks `/api/status` on startup and exits with an `lsof` command if the port is occupied.

**Static files not found:** Verify the file exists in `docs/`. Check the route table above for which directory is served.

## Future Improvements

### API Documentation Section ✅

The API section is implemented end-to-end. `apiEffect` runs TypeDoc, parses `globals.md`, and generates `docs-src/pages/api.md` with a grouped `{% listnav %}` index. `apiPagesEffect` processes individual API Markdown files through the Markdoc + Shiki pipeline and writes HTML fragments to `docs/api/<category>/<name>.html`. The `api.html` layout is served for direct navigation; lazy-loaded fragments are fetched by `module-lazyload` via listnav selection.

The `api.html` template variables (`{{ api-category }}`, `{{ api-name }}`, `{{ api-kind }}`, `{{ toc }}`) are populated by `pagesEffect` in `effects/pages.ts` — breadcrumbs and sidebar TOC are filled on direct API page navigation.

### Blog Section ✅

The blog section is fully implemented. See `server/TASKS.md` for the completed task list.

#### Overview

Blog posts live in `docs-src/pages/blog/` — a subdirectory of the existing pages directory. They are processed by the existing `docsMarkdown` signal and `pagesEffect` with no new signals or build effects. The blog overview page (`docs-src/pages/blog.md`) is authored content whose main body is generated at build time (3 latest post excerpts injected by `pagesEffect`).

```
docs-src/pages/blog/          ← blog post markdown files
  YYYY-MM-DD-slug.md          ← recommended naming (date prefix enables natural sorting)

docs-src/pages/blog.md        ← blog index page (frontmatter authored; body generated)

docs/blog/                    ← build output (individual post HTML files)
docs/blog.html                ← build output (overview page)
```

#### Data Flow

```
docs-src/pages/blog/*.md
       │
       ▼  docsMarkdown (existing watchFiles on PAGES_DIR/**/*.md)
       │  extractFrontmatter → PageMetadata (+ date, author fields)
       │  Markdoc parse/transform/render
       ▼
pagesEffect
  ├─ sorts blog posts (section === 'blog') by metadata.date desc
  ├─ for each blog post: injects prev/next vars → applyTemplate → docs/blog/<slug>.html
  └─ for blog.md: replaces htmlContent with 3-excerpt card HTML → applyTemplate → docs/blog.html
```

#### Extended `PageMetadata`

Two new optional fields on the existing type (parsed in `extractFrontmatter`):

```ts
date?: string          // YYYY-MM-DD — required for blog posts, used for sort order
author?: string        // display name; maps to {{ author }} in blog.html layout
```

The `blog.html` layout also uses `author-avatar` and `author-bio`. These are read directly from frontmatter via the existing `...Object.fromEntries(metadata)` spread in `applyTemplate`, so no additional type changes are needed for those.

#### Components

Two new custom elements handle blog-specific rendering:

**`card-blogmeta`** (`examples/card-blogmeta/`) — reactive Le Truc component for publication metadata.
- **Attributes:** `date` (ISO string), `author`, `avatar` (URL, optional), `reading-time` (pre-computed string, optional)
- **Behaviour:** formats `date` into locale-aware display text on the inner `<time>` element via `toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })`; shows/hides avatar `<img>`; sets author name text. Using `undefined` as locale picks up the user's system locale; the ISO date is a valid fallback without JS.
- **Used in:** `blog.html` layout header; inside `<card-blogpost>` excerpt cards; available via `{% blogmeta %}` Markdoc tag.

**`card-blogpost`** (`examples/card-blogpost/`) — CSS-only structural component scoping excerpt card styles.
- No `.ts` file — registered as a bare `HTMLElement` (same pattern as `card-callout`).
- **Used in:** blog overview page (3 excerpt cards generated by `pagesEffect`); available via `{% blogpost %}` Markdoc tag for manual use.

#### Blog-Specific Template Variables

Injected by `applyTemplate` (via optional `extraReplacements`) when rendering blog posts (`section === 'blog'`):

| Variable | Source |
|---|---|
| `published-date` | `metadata.date` — ISO string passed to `card-blogmeta date="…"` attribute |
| `reading-time` | `Math.ceil(wordCount / 200)` — word count from HTML-stripped content |
| `blog-tags` | `<span class="tag">…</span>` elements joined from `metadata.tags ?? []` |
| `prev-post` | URL of chronologically previous post (empty string at boundary) |
| `prev-post-title` | Title of previous post |
| `next-post` | URL of chronologically next post (empty string at boundary) |
| `next-post-title` | Title of next post |

`applyTemplate` gains an optional `extraReplacements: Record<string, string>` parameter. `pagesEffect` pre-computes prev/next by sorting all blog posts (date desc) before the per-file render loop.

#### Blog Overview Excerpt Injection

In `pagesEffect`, before calling `applyTemplate` for `blog.md` (`relativePath === 'blog.md'`), replace `processedFile.htmlContent` with 3 `<card-blogpost>` elements generated from the sorted post list. Each card contains: emoji, title wrapped in `<a href="/blog/<slug>">`, a `<card-blogmeta>` element with date/author/reading-time, and a description `<p>`.

#### Layouts

| Route | Layout file | Set by |
|---|---|---|
| `/blog` | `page.html` | `layout: page` in `blog.md` frontmatter |
| `/blog/<slug>` | `blog.html` | `layout: blog` in each post's frontmatter |

`blog.html` already exists with a full-featured post template. The `.blog-meta` block is replaced with `<card-blogmeta>` (the existing markup with the typo is removed entirely). `overview.html` is mapped in `ROUTE_LAYOUT_MAP` but does not affect the build pipeline — `layout: page` is the correct choice for 3 static excerpts.

#### Routing

A new route must be added to `serve.ts` before the catch-all `/:page`:

```
GET /blog/:slug  →  serve docs/blog/<slug>.html  (guarded by BLOG_OUTPUT_DIR)
```

`BLOG_OUTPUT_DIR = join(OUTPUT_DIR, 'blog')` is a new constant in `config.ts` used for path-traversal guarding.

#### Key Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Blog post location | `docs-src/pages/blog/` | Separate `docs-src/blog/` dir with new signal | Reuses existing `docsMarkdown` pipeline; zero new infrastructure |
| Overview content generation | Inject `<card-blogpost>` HTML into `blog.md` in `pagesEffect` | Custom Markdoc tag; separate `blogEffect` | Fewest moving parts; reactive chain is automatic |
| Blog index layout | `page.html` | `overview.html` | `overview.html`'s search/filter/sort JS is overkill for 3 static excerpts |
| Post ordering | `metadata.date` desc | `lastModified` | Explicit date in frontmatter is author-controlled and predictable |
| Prev/next nav | Pre-computed in `pagesEffect` loop | Separate navigation pass | All data already available in the same `pagesEffect` run |
| Post filename convention | `YYYY-MM-DD-slug.md` (recommended) | Any filename with `date` frontmatter | Date prefix enables natural sort in file explorers; frontmatter `date` is the authoritative value |
| Date formatting | `card-blogmeta` component (`toLocaleDateString(undefined, …)`) | Server-side formatting; inline script | Uses user's actual locale; ISO date is a valid no-JS fallback; scoped to the component |

### FAQ Section

Adding an FAQ section with collapsible question/answer blocks requires:

- A new `faq.markdoc.ts` schema (e.g., `{% faq %}` / `{% question %}`) that renders to `<details><summary>` elements or a custom `<module-faq>` component
- Alternatively, reuse the native HTML `<details>` element directly in Markdoc content without a custom schema
- Consider grouping questions by topic with anchor links for direct linking to individual answers

### Developer Experience

- **Incremental TypeDoc.** `apiEffect` runs `typedoc` via `Bun.spawn` on every library source change, regenerating all API docs. For large APIs, this is slow. TypeDoc's `--watch` mode or incremental output could help.
- **Parallel effect execution.** Effects are registered sequentially in `build.ts`. Effects with independent dependency graphs (e.g., `cssEffect` and `sitemapEffect`) could run in parallel for faster builds.
- **Error overlay improvements.** The HMR error overlay is a plain `div` injected into `document.body`. A more structured overlay with file/line info and dismiss functionality would improve the development experience.
