# Source Map

Where to find things in the server/ build system. Read this before locating any source file.

## Authoritative Documents

| What you need | Where to look |
|---|---|
| Architecture overview, effects table, file signals, HTTP routes, HMR | `server/SERVER.md` |
| Test strategy, conventions, verification processes | `server/TESTS.md` |
| Open tasks and prior design decisions | `server/TASKS.md` |
| Template system design and patterns | `server/templates/README.md` |

## Source Files

**Root orchestration:**

| File | Contents |
|---|---|
| `server/build.ts` | Effect orchestration: initialises all 13 effects, awaits `ready` promises, HMR broadcast |
| `server/dev.ts` | Development entry point: wires `serve.ts` + `build.ts` + SIGINT shutdown |
| `server/serve.ts` | HTTP + WebSocket server (`Bun.serve`): all routes, layout caching, HMR injection, `guardPath()` |
| `server/config.ts` | All path constants, page ordering, route-to-layout map, MIME types, server config |
| `server/io.ts` | File I/O utilities: `writeFileSafe`, `calculateFileHash`, `createFileInfo`, `getCompressedBuffer`, `isPlaywrightRunning` |
| `server/file-signals.ts` | All reactive `List<FileInfo>` signal definitions; the 4-stage `docsMarkdown` pipeline |
| `server/file-watcher.ts` | `watchFiles()` — creates a reactive `List<FileInfo>` with `Bun.Glob` + debounced `fs.watch` |
| `server/html-shaping.ts` | HTML post-processing: `highlightCodeBlocks` (Shiki), `resolveInternalLinks`, `injectModuleDemoPreview` |
| `server/markdoc-constants.ts` | Attribute definitions (`ClassAttribute`, `titleAttribute`, `commonAttributes`, `richChildren`, etc.) |
| `server/markdoc-helpers.ts` | Markdoc utilities: node traversal, slug generation, `html` Tag builder, `splitContentBySeparator`, `transformChildrenWithConfig` |
| `server/markdoc.config.ts` | Markdoc config: registers all node overrides and tag schemas |
| `server/typedoc-heading-shift.mjs` | TypeDoc plugin: shifts heading levels down by 2 post-render |
| `typedoc.json` | TypeDoc configuration: entry point, output dir, plugins, rendering options |

**Effects** (`server/effects/`):

| File | What it produces |
|---|---|
| `api.ts` | `docs-src/api/**/*.md` + `docs-src/pages/api.md` (runs TypeDoc) |
| `api-pages.ts` | `docs/api/**/*.html` (HTML fragments from TypeDoc markdown) |
| `css.ts` | `docs/assets/main.css` (LightningCSS) |
| `examples.ts` | `docs/examples/*.html` (example pages with demo previews) |
| `js.ts` | `docs/assets/main.js` + sourcemap (Bun bundler) |
| `llms-manifest.ts` | `docs/llms.txt` (AI crawler manifest) |
| `md-mirror.ts` | `docs/**/*.md` (clean Markdown mirrors) |
| `menu.ts` | `docs-src/includes/menu.html` (navigation menu fragment) |
| `mocks.ts` | `docs/test/<component>/mocks/` (copied mock files) |
| `pages.ts` | `docs/*.html` + `docs/blog/*.html` (full page renders via Markdoc + layout templates) |
| `service-worker.ts` | `docs/sw.js` (service worker with asset cache hashing) |
| `sitemap.ts` | `docs/sitemap.xml` |
| `sources.ts` | `docs/sources/*.html` (syntax-highlighted source tab groups) |

**Templates** (`server/templates/`):

| File | Contents |
|------|----------|
| `utils.ts` | Core: `html`/`xml`/`css`/`js` tagged templates, `raw()`/`RawHtml`, `escapeHtml`, `when`, `unless`, `mapSafe`, `fragment`, `indent`, `minify`, validators |
| `constants.ts` | Shared constants: MIME types, validation patterns, error messages, environment config |
| `fragments.ts` | Component source tab group: `tabButton`, `tabPanel`, `tabGroup`, `componentInfo` |
| `hmr.ts` | HMR WebSocket client: `hmrClient`, `hmrClientMinimal`, `hmrScriptTag` |
| `menu.ts` | Navigation menu: `menuItem`, `menu` |
| `performance-hints.ts` | Resource preloading: `preloadLink`, `performanceHints`, `enhancedPerformanceHints` |
| `service-worker.ts` | Service worker: `serviceWorker`, `generateCacheName`, install/activate event listeners |
| `sitemap.ts` | XML sitemap: `sitemap`, `sitemapUrl`, `calculatePriority` |

**Schemas** (`server/schema/`):

| File | Renders as |
|---|---|
| `blogmeta.markdoc.ts` | `card-blogmeta` |
| `blogpost.markdoc.ts` | `card-blogpost` |
| `callout.markdoc.ts` | `card-callout` |
| `carousel.markdoc.ts` | `module-carousel` (with `slide`) |
| `demo.markdoc.ts` | `module-demo` |
| `fence.markdoc.ts` | `module-codeblock` |
| `heading.markdoc.ts` | Accessible `<h1>`-`<h6>` with anchor links |
| `hero.markdoc.ts` | Hero section |
| `link.markdoc.ts` | Node override: `.md` → `.html` link rewriting |
| `listnav.markdoc.ts` | `module-listnav` (lazy sidebar navigation) |
| `section.markdoc.ts` | `<section>` wrapper |
| `sources.markdoc.ts` | Source code viewer |
| `slide.markdoc.ts` | Carousel slide |
| `table.markdoc.ts` | `<table>` |
| `tabgroup.markdoc.ts` | `module-tabgroup` |

**Tests** (`server/tests/`):

| Location | Covers |
|---|---|
| `server/tests/helpers/test-utils.ts` | Shared test utilities (all tests import from here) |
| `server/tests/*.test.ts` | Core modules: config, io, markdoc-constants, markdoc-helpers, file-watcher, serve |
| `server/tests/schema/*.test.ts` | One file per Markdoc schema |
| `server/tests/templates/*.test.ts` | One file per template module |
| `server/tests/effects/*.test.ts` | One file per build effect |

## Quick Lookup

- Changing how a page is rendered → `server/effects/pages.ts` + `server/html-shaping.ts` + layout in `docs-src/layouts/`
- Adding or changing a Markdoc tag → `server/schema/` + `server/markdoc.config.ts`
- Changing the Markdoc helper utilities → `server/markdoc-helpers.ts`
- Changing the Markdoc attribute system → `server/markdoc-constants.ts`
- Adding a new build effect → `server/effects/` + `server/build.ts`
- Changing how files are watched → `server/file-watcher.ts` + `server/file-signals.ts`
- Changing TypeDoc output structure → `typedoc.json` + `server/typedoc-heading-shift.mjs` + `server/effects/api.ts`
- Changing HTTP routes or layout selection → `server/serve.ts` + `server/config.ts`
- Changing HMR behavior → `server/serve.ts` (WebSocket) + `server/templates/hmr.ts` (client)
- Changing a template function → `server/templates/`
- Security concern (`guardPath`, escaping) → `server/serve.ts` + `server/templates/utils.ts`
