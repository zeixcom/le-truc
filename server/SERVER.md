# Server & Build System

The Le Truc development server and build system provide a unified solution for documentation generation, component development, and testing — with integrated Hot Module Replacement (HMR) for live reloading.

## Quick Start

```bash
bun run dev              # Development server with HMR + file watching
bun run serve            # Serve pre-built content (no HMR)
bun run serve:docs       # Build docs, then serve
bun run serve:examples   # Build examples, then serve (Playwright-safe)
bun run build:docs       # One-shot docs build
bun run test             # Run src/ unit tests + all Playwright tests
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
| `test` | `bun test src/tests && node node_modules/.bin/playwright test examples` | N/A | N/A | N/A |
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
  │     ├─▶ mdMirrorEffect         → docs/**/*.md  (clean Markdown mirrors)
  │     └─▶ llmsFullManifestEffect → docs/llms-full.txt
  → pageInfos (Memo: page navigation data)
  │     ├─▶ menuEffect         → docs-src/includes/menu.html
  │     ├─▶ sitemapEffect      → docs/sitemap.xml
  │     └─▶ llmsManifestEffect → docs/llms.txt
  → fullyProcessed (Task: Markdoc parse → transform → render → Shiki → post-processing)
        └─▶ pagesEffect        → docs/**/*.html (with alternate link in <head>)
```

### Effects

Each effect factory calls `createBuildEffect(label, [...signals], run, onRebuild)` (`server/effects/build-effect.ts`) and returns `{ cleanup: Cleanup, ready: Promise<void> }`. `ready` resolves after the first successful run; `build()` awaits all `ready` promises to know when the initial build is done. A failure on that first run rejects `ready` instead — `run` throws to signal failure — so a one-shot `build:docs` fails loudly rather than silently shipping incomplete output; a failure on a later, file-watch-triggered run is logged and the effect just waits for the next change. See `references/effect-pattern.md` for the full contract.

| Effect | Depends On | Output | Tool |
|--------|-----------|--------|------|
| `apiEffect` | `libraryScripts.sources` | `docs-src/api/**/*.md`, `docs-src/pages/api.md` | TypeDoc + typedoc-plugin-markdown |
| `apiPagesEffect` | `apiMarkdown.sources` | `docs/api/**/*.html` | Markdoc + Shiki (HTML fragments) |
| `cssEffect` | `docsStyles`, `componentStyles` | `docs/assets/main.css` | LightningCSS (`bunx lightningcss`) |
| `jsEffect` | `docsScripts`, `libraryScripts`, `componentScripts` | `docs/assets/main.js` + sourcemap | `bun build` (`DEV_MODE=true` unless `CI=true`, see [Environment Variables](#environment-variables)) |
| `staticAssetsEffect` | — (one-shot copy, not watched) | `docs/**` (static assets from `docs-src/static/`) | File copy |
| `serviceWorkerEffect` | All style + script sources | `docs/sw.js` | Template generation |
| `examplesEffect` | `componentMarkdown`, `componentMarkup` | `docs/examples/<name>.html` | Markdoc + Shiki |
| `mocksEffect` | `componentMocks.sources` | `docs/test/<component>/mocks/*` | File copy |
| `sourcesEffect` | `componentMarkup`, `componentStyles`, `componentScripts` | `docs/sources/<name>.html` | Shiki-highlighted tab groups |
| `pagesEffect` | `docsMarkdown.fullyProcessed` | `docs/**/*.html` | Layout templating |
| `menuEffect` | `docsMarkdown.pageInfos` | `docs-src/includes/menu.html` | Template generation |
| `sitemapEffect` | `docsMarkdown.pageInfos` | `docs/sitemap.xml` | XML template |
| `mdMirrorEffect` | `docsMarkdown.processed` | `docs/**/*.md` | Regex tag stripping |
| `llmsManifestEffect` | `docsMarkdown.pageInfos` | `docs/llms.txt` | Template generation |
| `llmsFullManifestEffect` | `docsMarkdown.processed` | `docs/llms-full.txt` | Curated concatenation |
| `tsrxEffect` | `componentTsrx.sources` | `server/generated/tsrx/*` (gitignored) | Inlined TSRX compiler (ADR 0024) |

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
├── blog/
│   ├── <slug>.html       # Individual blog post pages
│   └── <slug>.md         # Clean Markdown mirrors (agent-readable)
├── examples/
│   └── <name>.html       # Pre-built example pages
├── sources/
│   └── <name>.html       # Syntax-highlighted source tab groups
├── test/
│   └── <component>/mocks/ # Copied mock files for component tests
├── <page>.html           # Documentation pages (with alternate link in <head>)
├── <page>.md             # Clean Markdown mirrors (agent-readable)
├── llms.txt              # AI crawler entry point (link index)
├── llms-full.txt         # AI crawler full content (concatenated reference)
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

## Agent-Oriented Content Discovery

GitHub Pages serves static files and cannot set response headers dynamically, so `Accept: text/markdown` content negotiation is unavailable. Instead, the build pipeline uses **parallel path discovery**: every documentation page is published in two formats, and a manifest file lists all pages for AI crawlers.

### MD-Mirror (`mdMirrorEffect`)

**File:** `server/effects/md-mirror.ts`  
**Depends on:** `docsMarkdown.processed`  
**Outputs:** `docs/**/*.md` — one file per source page, alongside the corresponding `.html`

The raw Markdown content (frontmatter already stripped by the `processed` stage) is passed through `stripMarkdocTags()`, which applies these transformations:

| Source Pattern | Output |
|----------------|--------|
| `{% tab title="X" %}…{% /tab %}` | `### X\n\ncontent` |
| `{% tab %}…{% /tab %}` | `---\n\ncontent` |
| `{% callout .CLASS title="T" %}…{% /callout %}` | `> **T:** content` |
| `{% callout .CLASS %}…{% /callout %}` | `> **CLASS:** content` |
| `{% tabs %}`, `{% tabgroup %}`, `{% hero %}`, `{% section %}`, `{% carousel %}`, `{% slide %}`, `{% demo %}`, `{% listnav %}` | Strip open/close tags, keep content |

The tab-with-title rule must run before the bare-tab rule to avoid false matches. `serializeFrontmatter()` prepends a minimal YAML block (title, description, emoji, date, author, tags) reconstructed from the parsed `PageMetadata`.

### Link Discovery (`pagesEffect`)

**File:** `server/effects/pages.ts` → `applyTemplate()`  
**Layouts:** `docs-src/layouts/page.html`, `blog.html`, `api.html`, `overview.html`

Every HTML page generated by `pagesEffect` includes an alternate link in its `<head>`:

```html
<link rel="alternate" type="text/markdown" title="Agent-readable content" href="./page.md" />
```

This is injected via the `'alternate-link'` key in `applyTemplate()`'s `replacements` map, using `processedFile.relativePath` (which already carries the `.md` extension). Layouts include the `{{ alternate-link }}` placeholder immediately before `</head>`. The `test.html` and `example.html` layouts are omitted — they serve pages that have no `.md` mirrors.

### Root Discovery (`llmsManifestEffect`)

**File:** `server/effects/llms-manifest.ts`  
**Depends on:** `docsMarkdown.pageInfos`  
**Output:** `docs/llms.txt`

`generateLlmsTxt()` groups all `PageInfo` entries by section, sorts by `PAGE_ORDER` index then alphabetically, and emits a structured Markdown file:

```
# Le Truc Documentation
> High-performance, signal-based web components.

## Core Reference
- [Introduction](./index.md)
- [Getting Started](./getting-started.md)
…

## Blog
- [Post Title](./blog/YYYY-MM-DD-slug.md)
…
```

Section name mapping: no section → "Core Reference"; `api` → "API Reference"; `components` → "Component Library"; `blog` → "Blog"; `examples` → "Examples"; other → capitalized section name. Section order follows `SECTION_ORDER` in `llms-manifest.ts`; unknown sections fall after the known ones, sorted alphabetically.

### Full Content (`llmsFullManifestEffect`)

**File:** `server/effects/llms-full-manifest.ts`  
**Depends on:** `docsMarkdown.processed`  
**Output:** `docs/llms-full.txt`

While `llms.txt` is a link index, `llms-full.txt` is the **authoritative concatenated content** file defined by the llms.txt spec — the single document AI tools prefer over scrape-and-summarize. `generateLlmsFullTxt()` concatenates a curated subset of documentation in a fixed order:

1. `README.md` (read from repo root, plain Markdown — passed through verbatim)
2. Curated narrative pages from `docs-src/pages/`: `index`, `getting-started`, `components`, `styling`, `data-flow` — each run through `stripMarkdocTags()` (same transform as `mdMirrorEffect`)
3. `ARCHITECTURE.md` (repo root, plain Markdown)
4. `AGENTS.md` (repo root, plain Markdown — includes the factory form and the "Surprising Behaviors" gotchas)

Sections are delimited by `---` and headed with an H1. Blog posts, `about.md`, `examples.md`, and the per-symbol TypeDoc API files are excluded to keep the file focused on authoring guidance. Narrative pages have Markdoc tags stripped; standalone root docs pass through unchanged (they are plain Markdown). Standalone docs are read from `ROOT` via `Bun.file().text()` inside the effect.

### TSRX Compiler (`tsrxEffect`)

**File:** `server/effects/tsrx.ts`  
**Depends on:** `componentTsrx.sources` (`examples/**/*.tsrx`)  
**Outputs:** `server/generated/tsrx/` — `<tag>.server.ts` (render function), `<tag>.client.ts` (generated `defineComponent` module), `<tag>.css` (verbatim tag-scoped CSS), and `registry.json`

The inlined TSRX compiler (ADR 0024, milestones 1–4) compiles isomorphic single-file `.tsrx` components — server args, signals, `expose()`, markup, event handlers, and scoped styles in one source — into the split compiler's two halves. The server module re-declares the `@{ }` setup verbatim against the runtime harness (`server/tsrx/runtime.ts`, where signals are their initial values in a box) and renders HTML strings; the client module is a generated factory importing solely from `@zeix/le-truc`, side-effect-importing every addressed child component's module so its `declare global` tag-map entry is in scope (type flow by projection — the registry spans migrated `.tsrx` tags and the hand-written example tags). Extension activation (ADR 0024 sub-design 8) is declared as `export const config` in the source: the compiler validates the keys, auto-imports the extension factories with the form variant leading, and carries Parser-call `expose()` initializers and `defineMethod()` as ambients (real imports client-side, inert shims in the runtime harness). The generated clients are consumed by the Custom Element Manifest: `bun run build:cem` runs `scripts/build-tsrx.ts` (this corpus compile, standalone) before `cem analyze`, whose globs read them with `@zeix/cem-plugin-le-truc` unchanged — the compiler carries the component JSDoc above each `export default defineComponent(` so extraction is identical (ADR 0024 sub-design 9; equivalence pinned in `server/tests/tsrx/cem.golden.test.ts`). Errors fail the build; the remaining gate (`@for` over non-List reactive sources) logs TSRX001 and skips the file.

Template control flow follows the pinned `@tsrx/core` 0.1.63 directive grammar: `@if (cond) { … } @else { … }` and `@switch (disc) { @case expr: { … } @default: { … } }` render server-known branches (the server evaluates the condition against real args; the client addresses `@if` branch roots through union selectors), `@try { … } @catch (e) { … }` is a render-time error boundary (arms render into isolated buffers so a mid-arm throw cannot leak partial markup), and `@for` over a declared `createList` lowers to keyed in-place items plus an extracted `<template>` with `<slot>` holes, reconciled client-side by `reconcile()`. Dynamic rendering is `html={dataRef}` — the spelling of the upstream `{html expr}` keyword (newer grammar than the pin) — rendered through `sanitizeHtml` (scripts, `on*` attributes, and unsafe URL schemes stripped). Constructs the pinned parser cannot parse (statement-form `switch`, the `{html}`/`{text}`/`{ref}` keywords, setup `await`, `component` declarations) fail with a parse-error hint naming the construct; `@pending` async arms are gated until async server rendering exists.

The compiler itself lives in `server/tsrx/`, split for pipeline role (each concern in its own file, front-end parsing wired together by `compiler.ts`): `core.ts` is the only module importing `@tsrx/core` VALUES (pinned 0.1.63, see `core-shim.d.ts` — a pure re-export leaf, so a pin upgrade touches only it and the shim; siblings may still import the `TsrxNode` TYPE, which erases at compile time); `ir.ts` owns the shared IR type vocabulary (`TemplateNode`, `AttributeIR`, `ComponentIR`, `ExtractContext`, …) as a pure type leaf; `compiler.ts` owns `compileSource`; `lower-template.ts` lowers JSX/`@if`/`@switch`/`@try`/`@for` into that IR (mutually recursive, so it moves as one unit); `classify-attributes.ts` classifies JSXAttributes into `AttributeIR`/`ComposeAttrIR`, including the shared `pass={{ }}` entry parser (ADR 0024 sub-design 10); `infer-type.ts` infers a signal's value type from its initializer; `config.ts` extracts `export const config` only; `imports.ts` resolves `.tsrx` compose imports and collects/places plain (non-`.tsrx`) imports; `walk.ts` is the one structural `TemplateNode` visitor (plus derived collectors) shared by the front end and the analyzer; `evaluability.ts` is the single home of the server-known dependency-closure rule (`dependenciesOf`/`isServerEvaluable`), consumed by `imports.ts`, `emit-server.ts`, and the analyzer; `ast-utils.ts` holds shared AST predicates/text-extraction helpers and the recognized-name vocabulary (signal constructors, context names, parser factories, JS/DOM globals) consumed across the front end. `analysis/{plan,selectors,naming,harvest,loops,effects}.ts` produce the client emission plan (element addressing, harvest rules incl. arg→DOM substitution and List adoption, hoisted-const rebinding, `@if` union addressing) as four explicit passes threaded through a shared `AnalysisContext`; `emit-server.ts`/`emit-client.ts` render the artifacts, `indent.ts` makes verbatim-slice reindentation template-literal-safe, `globals.d.ts` declares the ambient vocabulary for editor surfaces (pinned to `ast-utils.ts`'s recognized sets by `globals.test.ts`), and `css.ts` dedents the `<style>` block's verbatim stylesheet. See `server/tsrx/LE_TRUC_COMPILER.md` for the full module inventory and pipeline walkthrough. Golden tests in `server/tests/tsrx/` pin server renders, CSS bytes, client snapshots (regenerate with `UPDATE_SNAPSHOTS=1 bun test server/tests/tsrx`), diagnostics, the language-feature gates (`features.test.ts`), and an emit-then-check typecheck of the generated client modules.

### Path Constants

| Constant | Path | Description |
|----------|------|-------------|
| `LLMS_TXT_FILE` | `docs/llms.txt` | Output path for the AI crawler link index |
| `LLMS_FULL_TXT_FILE` | `docs/llms-full.txt` | Output path for the AI crawler full content |

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

All HTML routes support `Accept: text/markdown` to return raw `.md` source from `docs-src/pages/`. Bare section roots (`/blog`, `/examples`, `/api`) resolve to directories under `docs/` via `GET /:page` — they redirect 301 to the matching `<page>.html` when it exists and 404 otherwise; `handleStaticFile` 404s on directory paths generally, so no route can attempt `sendfile` on a directory.

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

Templates use `{{ variable }}` substitution and `{{ include 'file' }}` directives (resolved from `docs-src/includes/`). `api.html` additionally uses `{{ api-category }}`, `{{ api-name }}`, `{{ api-kind }}`, and `{{ toc }}`, populated by `pagesEffect` for breadcrumbs and sidebar TOC on direct API page navigation.

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

The server has a test suite using **Bun's built-in test runner** (`bun:test`). Tests live in `server/tests/` and mirror the source module structure (`effects/`, `schema/`, `templates/`, plus top-level files for `config`, `io`, `file-watcher`, `serve`, `markdoc-helpers`, `markdoc-constants`, `html-shaping`).

| Script | Command | Description |
|--------|---------|-------------|
| `test:server` | `bun test server/tests` | Run all server tests |
| `test:server:unit` | `bun test server/tests --bail` | Run with bail on first failure |
| `test:server:integration` | `bun test server/tests --timeout 10000` | Run with longer timeout |
| `test:server:watch` | `bun test server/tests --watch` | Watch mode for development |

See [TESTS.md](./TESTS.md) for the full test plan: scope, conventions, file-by-file coverage, and verification processes to run after changing a given part of the pipeline.

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
| `STATIC_DIR` | `docs-src/static/` | Static assets copied verbatim by `staticAssetsEffect` |
| `OUTPUT_DIR` | `docs/` | Final build output |
| `ASSETS_DIR` | `docs/assets/` | Built assets |
| `BLOG_OUTPUT_DIR` | `docs/blog/` | Built blog post HTML pages |
| `EXAMPLES_DIR` | `docs/examples/` | Built example pages |
| `SOURCES_DIR` | `docs/sources/` | Highlighted source fragments |
| `TEST_DIR` | `docs/test/` | Copied mock files for component tests |
| `SITEMAP_FILE` | `docs/sitemap.xml` | SEO sitemap |
| `LLMS_TXT_FILE` | `docs/llms.txt` | AI crawler entry point |

### Page Ordering

`PAGE_ORDER` controls navigation menu order:
`index`, `getting-started`, `components`, `props`, `effects`, `extensions`, `data-flow`, `lists`, `context`, `async`, `styling`, `examples`, `api`, `blog`, `about`

### Guide Chapters

`CHAPTERS` groups guide pages into chapters with a shared sidebar heading and a prev/after stepper:

- **Sidebar grouping:** `menu()` in `templates/menu.ts` inserts one `<li class="group" role="presentation">` heading before the first chapter member present in the sorted root pages. Styling lives in `examples/section/menu/section-menu.css` (`.group` spans the full grid row).
- **Chapter stepper:** `getChapterVars()` in `effects/pages.ts` computes a `chapter-nav` template variable for every root page that belongs to a chapter. `chapterNav()` in `templates/chapter-nav.ts` renders `<nav class="content chapter-nav">` with "Part k of n" and prev/next links; the `{{ chapter-nav }}` placeholder in `layouts/page.html` collapses to nothing for non-member pages. Missing siblings (a chapter page absent from the build) are skipped; the stepper collapses entirely when no links remain. Styling lives in `examples/section/menu/chapter-nav.css`.

Constraint: member slugs must appear in `PAGE_ORDER`, and each chapter's members should be contiguous in it — the group heading renders at the position of the first present member.

## Environment Variables

| Variable | Values | Effect |
|----------|--------|--------|
| `NODE_ENV` | `development` | Enables HMR, file watching, debug features |
| | `production` / unset | Disables HMR, production-like serving |
| `CI` | `true` | `jsEffect` builds `docs/assets/main.js` with the library's `DEV_MODE=false` (published-site behavior) |
| | unset | `jsEffect` builds with `DEV_MODE=true` (le-truc's own dev-only diagnostics, e.g. the `debug()` instrumentation extension — see [ADR 0022](../adr/0022-debug-extension-for-visual-and-console-instrumentation.md)) |
| `PLAYWRIGHT` | `1` | Disables HMR even in development; prevents WebSocket connections and script injection |
| `DEBUG` | `1` | Verbose logging for file watching and build events |

`jsEffect` (used by `bun run dev`, `serve:docs`, and `build:docs` alike) keys `DEV_MODE` off `CI`, not `NODE_ENV`: GitHub Actions sets `CI=true` automatically, which is the one signal that reliably distinguishes a real CI run (the published site's `build:docs` in `ci-cd.yml`/`static.yml`) from *any* local invocation. Every local workflow — `bun run dev`, `serve:docs`, or running `build:docs` by hand — therefore defaults to `DEV_MODE=true`; only an actual CI run ships `DEV_MODE=false` (PROD) assets. The separate `serve:examples`/`build:examples:js` pipeline (package.json, used for the Playwright-safe pre-build) hardcodes `DEV_MODE=true` unconditionally, independent of `CI` — Playwright always wants DEV_MODE instrumentation live regardless of how it's invoked.

## Troubleshooting

**HMR not working:** Check `NODE_ENV=development` is set. Look for `__HMR__` messages in browser console. Verify WebSocket connection to `/ws`.

**Tests failing with HMR interference:** Verify `PLAYWRIGHT=1` is set. The `serve:examples` script sets this automatically.

**Build errors during development:** Errors display as an overlay in the browser. Check server console for full details. File watching continues after failures.

**Port conflict:** The server checks `/api/status` on startup and exits with an `lsof` command if the port is occupied.

**Static files not found:** Verify the file exists in `docs/`. Check the route table above for which directory is served.

## Blog Support

Blog posts live in `docs-src/pages/blog/` (`YYYY-MM-DD-slug.md` naming) and are processed by the existing `docsMarkdown` signal and `pagesEffect` — no dedicated signal or effect. `PageMetadata` carries blog-only optional fields (`date`, `author`, `author-avatar`, `modified-date`, `tags`); `pagesEffect` injects derived template variables (`published-date`, `modified-date`, `reading-time`, `blog-tags`, `author-avatar`, `prev-post(-title)`, `next-post(-title)`) via `applyTemplate`'s `extraReplacements` parameter when `section === 'blog'`. The blog overview page (`blog.md`, `page.html` layout) has its body replaced with 3 latest-post excerpt cards (`<card-blogpost>`) built directly by `generateBlogExcerpts()` in `pages.ts`, followed by a compact archive list of the remaining posts built by `generateBlogArchive()` (both not via a Markdoc tag); individual posts use the `blog.html` layout, which hardcodes a `<card-blogmeta>` element filled in via `{{ published-date }}`-style template variables. Routing: `GET /blog/:slug` in `serve.ts`, guarded by the `BLOG_OUTPUT_DIR` constant.

## Future Improvements

### FAQ Section

Adding an FAQ section with collapsible question/answer blocks requires:

- A new `faq.markdoc.ts` schema (e.g., `{% faq %}` / `{% question %}`) that renders to `<details><summary>` elements or a custom `<module-faq>` component
- Alternatively, reuse the native HTML `<details>` element directly in Markdoc content without a custom schema
- Consider grouping questions by topic with anchor links for direct linking to individual answers

### Developer Experience

- **Incremental TypeDoc.** `apiEffect` runs `typedoc` via `Bun.spawn` on every library source change, regenerating all API docs. For large APIs, this is slow. TypeDoc's `--watch` mode or incremental output could help.
- **Parallel effect execution.** Effects are registered sequentially in `build.ts`. Effects with independent dependency graphs (e.g., `cssEffect` and `sitemapEffect`) could run in parallel for faster builds.
- **Error overlay improvements.** The HMR error overlay is a plain `div` injected into `document.body`. A more structured overlay with file/line info and dismiss functionality would improve the development experience.
