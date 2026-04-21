<overview>
System layers, data flow, file signals, effects table, HTTP routes, and HMR. Read before touching any major component.
</overview>

## System Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│  dev.ts  (development entry point)                                   │
│  ┌─────────────────────────┐   ┌───────────────────────────────────┐ │
│  │  build.ts               │   │  serve.ts                         │ │
│  │  Reactive build pipeline│──▶│  HTTP + WebSocket server          │ │
│  │                         │   │                                   │ │
│  │  file-signals.ts        │   │  Routes, layout caching,          │ │
│  │  file-watcher.ts        │   │  HMR injection, guardPath()       │ │
│  │  effects/*              │   │                                   │ │
│  └─────────────────────────┘   └───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

`dev.ts` wires them together:
1. Imports `serve.ts` — starts `Bun.serve()` as a side-effect on import
2. Passes `broadcastToHMRClients` from `serve.ts` as `hmrBroadcast` to `build()`
3. Calls `build({ watch: true, hmrBroadcast })` to start the reactive pipeline
4. Handles `SIGINT`/`SIGTERM` for graceful shutdown

For one-shot builds (`bun run build:docs`), `build.ts` is executed directly; `serve.ts` is not involved.

## Reactive Build Pipeline

### File Signals

Each signal is a reactive `List<FileInfo>` created by `watchFiles()` in `file-watcher.ts`. Effects re-run automatically when these lists change.

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

### The `docsMarkdown` Pipeline

`docsMarkdown` is a multi-stage derived pipeline, not a single signal:

```
sources  (List<FileInfo>)
  → processed       (Memo: frontmatter extraction → PageMetadata)
  → pageInfos       (Memo: navigation + sitemap data)
  → fullyProcessed  (Task: Markdoc parse → transform → render
                          → Shiki highlighting → post-processing)
```

`pagesEffect` depends on `fullyProcessed`; `menuEffect` and `sitemapEffect` depend on `pageInfos`.

### Effects Table

| Effect | Input signals | Output |
|--------|--------------|--------|
| `apiEffect` | `libraryScripts.sources` | `docs-src/api/**/*.md`, `docs-src/pages/api.md` |
| `apiPagesEffect` | `apiMarkdown.sources` | `docs/api/**/*.html` |
| `cssEffect` | `docsStyles.sources`, `componentStyles.sources` | `docs/assets/main.css` |
| `jsEffect` | `docsScripts`, `libraryScripts`, `componentScripts` | `docs/assets/main.js` + sourcemap |
| `serviceWorkerEffect` | all style + script sources | `docs/sw.js` |
| `examplesEffect` | `componentMarkdown`, `componentMarkup` | `docs/examples/<name>.html` |
| `mocksEffect` | `componentMocks.sources` | `docs/test/<component>/mocks/*` |
| `sourcesEffect` | `componentMarkup`, `componentStyles`, `componentScripts` | `docs/sources/<name>.html` |
| `pagesEffect` | `docsMarkdown.fullyProcessed` | `docs/**/*.html` (all doc pages + blog posts) |
| `menuEffect` | `docsMarkdown.pageInfos` | `docs-src/includes/menu.html` |
| `sitemapEffect` | `docsMarkdown.pageInfos` | `docs/sitemap.xml` |

### Build Orchestration

`build()` in `build.ts`:
1. Calls all 11 effect factories — each returns `{ cleanup, ready }`
2. `await Promise.all([...ready promises])` — waits for every effect's first run
3. After all ready: broadcasts HMR `build-success` + `reload` (watch mode only)
4. Returns a cleanup function that calls all `cleanup()` functions for graceful shutdown

Effects register their `ready` resolver in the `finally` block so it fires on both `ok` and `err` paths.

## HTTP Server (`serve.ts`)

### Routes

| Route | Serves |
|-------|--------|
| `GET /` | `docs/index.html` |
| `GET /api/status` | Health check `"OK"` |
| `GET /ws` | WebSocket upgrade (HMR clients) |
| `GET /api/:category/:page` | `docs/api/<category>/<page>` (API fragment) |
| `GET /assets/:file` | `docs/assets/` (CSS, JS, images) |
| `GET /examples/:component` | `docs/examples/<name>.html` |
| `GET /sources/:file` | `docs/sources/<name>.html` |
| `GET /test/:component/mocks/:mock` | `examples/<component>/mocks/` |
| `GET /test/:component` | Component test harness (test.html layout) |
| `GET /blog/:slug` | `docs/blog/<slug>.html` |
| `GET /:page` | `docs/<page>.html` |
| `GET /favicon.ico` | `docs/favicon.ico` |

All HTML routes support `Accept: text/markdown` to return raw `.md` source from `docs-src/pages/`.

### Security: `guardPath()`

All dynamic path parameters pass through `guardPath(base, userPath)` before use. It resolves the joined path and rejects any result that doesn't start with `base`, preventing directory traversal. Never skip this check when adding a new file-serving route.

### Layout System

Layouts live in `docs-src/layouts/`:

| Layout | Used for |
|--------|----------|
| `page.html` | Standard documentation pages |
| `overview.html` | Index/overview pages |
| `api.html` | API reference pages |
| `blog.html` | Individual blog posts |
| `example.html` | Example component pages |
| `test.html` | Component test harness |

Layouts use `{{ variable }}` substitution and `{{ include 'file' }}` directives (resolved from `docs-src/includes/`). Layout files are cached in a `Map<string, string>` in `serve.ts`; the cache is bypassed in development so layout changes apply without a server restart.

### Static File Handling

`handleStaticFile` in `serve.ts`:
- Checks existence before serving; returns 404 for missing files
- Injects HMR WebSocket client script into HTML responses (development only)
- Sets MIME types from `MIME_TYPES` in `config.ts`
- Supports Brotli/Gzip via `getCompressedBuffer()` from `io.ts`

## Hot Module Replacement (HMR)

### Components

| Role | File |
|------|------|
| WebSocket server + broadcast | `serve.ts` (`broadcastToHMRClients`) |
| Build integration | `build.ts` (`options.hmrBroadcast`) |
| Browser client | `templates/hmr.ts` (injected into HTML in dev) |

### Message Protocol

Server → client:
- `"reload"` — trigger full page reload
- `{"type":"build-success"}` — build completed
- `{"type":"build-error","message":"..."}` — build failed
- `{"type":"file-changed","path":"..."}` — file changed notification
- `{"type":"pong"}` — keep-alive response

Client → server:
- `{"type":"ping"}` — keep-alive request

### Client Features

- Auto-reconnection with exponential backoff (max 10 attempts)
- Build error overlay injected into `document.body`
- `visibilitychange` reconnect (reconnects when tab becomes visible)
- `window.__HMR__` debug API: `.status()`, `.reconnect()`, `.disconnect()`
- Only injected when `NODE_ENV=development` and `PLAYWRIGHT` is not set

## Configuration (`config.ts`)

All path constants are **absolute paths** computed from `ROOT = join(import.meta.dir, '..')` at module load time — the server never needs `process.chdir`.

Key constants: `ROOT`, `SRC_DIR`, `COMPONENTS_DIR`, `INPUT_DIR`, `PAGES_DIR`, `API_DIR`, `LAYOUTS_DIR`, `INCLUDES_DIR`, `MENU_FILE`, `OUTPUT_DIR`, `ASSETS_DIR`, `BLOG_OUTPUT_DIR`, `EXAMPLES_DIR`, `SOURCES_DIR`, `TEST_DIR`.

`PAGE_ORDER` controls navigation menu order: `index`, `getting-started`, `components`, `styling`, `data-flow`, `examples`, `api`, `blog`, `about`.

## Environment Variables

| Variable | Effect |
|----------|--------|
| `NODE_ENV=development` | Enables HMR, file watching, bypasses layout cache |
| `PLAYWRIGHT=1` | Disables HMR even in development; prevents WebSocket injection |
| `DEBUG=1` | Verbose logging for file watching and build events |
