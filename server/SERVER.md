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
2. Calls `setHMRBroadcast(broadcastToHMRClients)` to connect build notifications to WebSocket clients
3. Calls `build({ watch: true })` to start the reactive pipeline with file watching
4. Handles `SIGINT`/`SIGTERM` for graceful shutdown

### Two Independent File Watchers

The system has two separate file-watching mechanisms:

| Watcher | Location | Purpose |
|---------|----------|---------|
| **Build watcher** | `file-watcher.ts` via `@zeix/cause-effect` `createList` | Feeds reactive signals; triggers rebuilds through the effect graph |
| **Server watcher** | `serve.ts` `setupFileWatcher()` via Node `fs.watch` | Broadcasts `file-changed` + `reload` to HMR WebSocket clients |

The build watcher drives correctness (rebuilds); the server watcher drives liveness (browser reload).

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
- **`build.ts`** — Orchestrates effects; plumbs HMR notifications via `setHMRBroadcast` / `notifyHMR`.

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

Each effect calls `createEffect(() => match([...signals], { ok, err }))` and returns a cleanup function.

| Effect | Depends On | Output | Tool |
|--------|-----------|--------|------|
| `apiEffect` | `libraryScripts.sources` | `docs-src/api/**/*.md` | TypeDoc + typedoc-plugin-markdown |
| `cssEffect` | `docsStyles`, `componentStyles` | `docs/assets/main.css` | LightningCSS (`bunx lightningcss`) |
| `jsEffect` | `docsScripts`, `libraryScripts`, `componentScripts` | `docs/assets/main.js` + sourcemap | `bun build` |
| `serviceWorkerEffect` | All style + script sources | `docs/sw.js` | Template generation |
| `examplesEffect` | `componentMarkdown`, `componentMarkup` | `docs/examples/<name>.html` | Markdoc + Shiki |
| `sourcesEffect` | `componentMarkup`, `componentStyles`, `componentScripts` | `docs/sources/<name>.html` | Shiki-highlighted tab groups |
| `pagesEffect` | `docsMarkdown.fullyProcessed` | `docs/**/*.html` | Layout templating |
| `menuEffect` | `docsMarkdown.pageInfos` | `docs-src/includes/menu.html` | Template generation |
| `sitemapEffect` | `docsMarkdown.pageInfos` | `docs/sitemap.xml` | XML template |

### Build Outputs

```
docs/
├── assets/
│   ├── main.css          # Minified CSS bundle
│   └── main.js           # Minified JS bundle + sourcemap
├── examples/
│   └── <name>.html       # Pre-built example pages
├── sources/
│   └── <name>.html       # Syntax-highlighted source tab groups
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
5. **Post-processing** — `.md` → `.html` link rewriting, API content wrapping, `module-demo` HTML entity decoding
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

Note: `link.markdoc.ts` exists as a schema file but is **not registered** in `markdoc.config.ts`. Link `.md` → `.html` conversion is handled by `postProcessHtml()` in `markdoc-helpers.ts` instead.

### Markdoc Constants

`markdoc-constants.ts` provides shared constants and attribute definitions used by all Markdoc schemas. It was extracted from `markdoc-helpers.ts` to avoid circular dependencies between helpers and schema files.

- **Attribute classes:** `ClassAttribute`, `IdAttribute`, `CalloutClassAttribute` — custom Markdoc attribute types with `validate()` and `transform()` methods
- **Attribute definitions:** `classAttribute`, `idAttribute`, `styleAttribute`, `titleAttribute`, `requiredTitleAttribute`, `commonAttributes`, `styledAttributes`
- **Children definitions:** `standardChildren`, `richChildren`

### Markdoc Helpers

`markdoc-helpers.ts` provides shared utilities for schema development:

- **Node utilities:** `extractTextFromNode()`, `transformChildrenWithConfig()`, `splitContentBySeparator()`
- **HTML generation:** `createNavigationButton()`, `createTabButton()`, `createAccessibleHeading()`, `createVisuallyHiddenHeading()`
- **Post-processing:** `postProcessHtml()` — link rewriting, API content wrapping
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
| `GET /assets/:file` | Static assets | `docs/assets/` |
| `GET /examples/:component` | Pre-built example HTML | `docs/examples/` |
| `GET /test/:component/mocks/:mock` | Test mock files | `examples/<component>/mocks/` |
| `GET /test/:component` | Component test page | `docs-src/layouts/test.html` + `examples/<component>/<component>.html` |
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

Layout files are cached in a `Map<string, string>` in `serve.ts` for performance.

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
| WebSocket server | `serve.ts` | Manages client connections, broadcasts messages |
| File watcher | `serve.ts` `setupFileWatcher()` | Detects changes, triggers reload broadcast |
| Build integration | `build.ts` `setHMRBroadcast()` | Forwards build success/error to server |
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
| `utils.ts` | `html`, `xml`, `css`, `js` tagged template literals; `escapeHtml`, `escapeXml`, `generateSlug`, `createOrderedSort`, validation helpers | All templates |
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
├── io.test.ts                     # IO utilities
├── markdoc-constants.test.ts      # Attribute classes and constant definitions
├── markdoc-helpers.test.ts        # Node utilities, tag helpers, post-processing
├── schema/
│   ├── fence.test.ts              # Code block schema
│   └── heading.test.ts            # Heading schema
└── templates/
    └── utils.test.ts              # Tagged template literals, escaping, validation
```

### Test Categories

| Category | Mocking | File I/O | Network | Typical runtime |
|----------|---------|----------|---------|-----------------|
| **Unit** | None | No | No | < 5 ms per test |
| **Integration** | Minimal | Temp dirs | No | < 500 ms per test |
| **Server** | Build pipeline | Temp dirs | localhost HTTP | < 2 s per test |

### Current Coverage (P0 — highest priority)

| Test file | Tests | Module |
|-----------|-------|--------|
| `io.test.ts` | 39 | File hashing, paths, compression, safe writes |
| `templates/utils.test.ts` | 95 | Tagged templates, escaping, slugs, sorting, validation |
| `schema/fence.test.ts` | 28 | Code block transformation pipeline |
| `markdoc-helpers.test.ts` | 45 | Node utilities, tag helpers, post-processing |
| `markdoc-constants.test.ts` | 40 | Attribute classes, constant definitions |
| `schema/heading.test.ts` | 29 | Heading levels, anchors, ID generation |

**Total:** 276 tests, ~200 ms execution time.

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
- [tests/README.md](./\_\_tests\_\_/README.md) — Test usage guidelines

## Configuration (`config.ts`)

### Directory Constants

| Constant | Path | Description |
|----------|------|-------------|
| `SRC_DIR` | `./src` | Library source |
| `COMPONENTS_DIR` | `./examples` | Component examples |
| `CSS_FILE` | `./examples/main.css` | CSS entry point |
| `TS_FILE` | `./examples/main.ts` | JS entry point |
| `TEMPLATES_DIR` | `./server/templates` | Template functions |
| `INPUT_DIR` | `./docs-src` | Documentation source root |
| `PAGES_DIR` | `./docs-src/pages` | Markdown pages |
| `API_DIR` | `./docs-src/api` | TypeDoc output (intermediate) |
| `LAYOUTS_DIR` | `./docs-src/layouts` | HTML layout templates |
| `INCLUDES_DIR` | `./docs-src/includes` | Includable HTML fragments |
| `MENU_FILE` | `./docs-src/includes/menu.html` | Generated menu |
| `OUTPUT_DIR` | `./docs` | Final build output |
| `ASSETS_DIR` | `./docs/assets` | Built assets |
| `EXAMPLES_DIR` | `./docs/examples` | Built example pages |
| `SOURCES_DIR` | `./docs/sources` | Highlighted source fragments |

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

### API Documentation Section

The current API pipeline generates TypeDoc Markdown into `docs-src/api/` (classes, functions, type-aliases, variables) but these files are not surfaced in the docs site as a navigable section. Adding an API section requires:

- A new `api.md` page (or auto-generated equivalent) using the `{% listnav %}` pattern from the Examples section, with grouped entries (Functions, Classes, Type Aliases, Variables) linking to individual API pages
- The `apiEffect` should generate or update a listnav-compatible index alongside the TypeDoc Markdown
- Individual API pages need to be processed through the Markdoc pipeline and rendered with the existing `api.html` layout (which already has breadcrumbs, sidebar TOC, and API-specific styling)
- The `api.html` layout has template variables (`{{ api-category }}`, `{{ api-name }}`, `{{ api-kind }}`, `{{ toc }}`) that the page generation pipeline does not currently populate

### FAQ Section

Adding an FAQ section with collapsible question/answer blocks requires:

- A new `faq.markdoc.ts` schema (e.g., `{% faq %}` / `{% question %}`) that renders to `<details><summary>` elements or a custom `<module-faq>` component
- Alternatively, reuse the native HTML `<details>` element directly in Markdoc content without a custom schema
- Consider grouping questions by topic with anchor links for direct linking to individual answers

### Developer Experience

- **Incremental TypeDoc.** `apiEffect` runs `typedoc` via `execSync` on every library source change, regenerating all API docs. For large APIs, this is slow. TypeDoc's `--watch` mode or incremental output could help.
- **Parallel effect execution.** Effects are registered sequentially in `build.ts`. Effects with independent dependency graphs (e.g., `cssEffect` and `sitemapEffect`) could run in parallel for faster builds.
- **Error overlay improvements.** The HMR error overlay is a plain `div` injected into `document.body`. A more structured overlay with file/line info and dismiss functionality would improve the development experience.
