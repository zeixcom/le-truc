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
bun run test:variants    # Run variant-set specs once per spelling (ADR 0039)
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
│  │  file-watcher.ts     │    │  /examples/*, /test/*, /:locale/*,  │ │
│  │  effects/*           │    │  /ws                                │ │
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
| `test:variants` | `bun scripts/test-variants.ts [<name>] [--flag]` | N/A | N/A | N/A |
| `test:server` | `bun test server/tests` | N/A | N/A | N/A |
| `test:server:watch` | `bun test server/tests --watch` | N/A | N/A | N/A |

## Reactive Build Pipeline

### Core Primitives

The build system is powered by `@zeix/cause-effect` reactive signals:

- **`file-watcher.ts`** — `watchFiles(directory, include, exclude?)` creates a reactive `List<FileInfo>` backed by runtime-neutral glob scanning (the `server/runtimes/` seam, LT-267). Under non-Playwright conditions, attaches `fs.watch` for incremental updates via the `watched` option of `createList`.
- **`file-signals.ts`** — Defines all source signals and the Markdoc processing pipeline.
- **`build.ts`** — Orchestrates effects; forwards HMR notifications via `options.hmrBroadcast`.

### The Runtime Seam (`server/runtimes/`, [ADR 0038](../adr/0038-runtime-neutral-build-path.md), LT-267)

All file IO, globbing and process spawning on the build path goes through one interface, `RuntimeIO`, with two implementations selected at module load: `bun.ts` (Bun.file / Bun.write / Bun.spawn / Bun.Glob) and `node.ts` (node:fs / node:child_process) — both loadable under any runtime, so `typeof Bun` is the only detection needed. This is what makes the published compiler package's own build path need *a* JS runtime, not Bun specifically; the emitted `.ts`/`.css` files are the interface to consumers and were already runtime-neutral (no bundler abstraction exists or is planned).

Deliberate properties:

- **One glob grammar.** `glob.ts` holds the shared translator both implementations use for scanning and matching, so a consumer's configured globs cannot match one file set under Bun and another under Node. Supported: `*`, `?`, `**/`, a trailing `**`, literals — not braces or character classes. Scans are sorted and skip dotfiles (matching Bun.Glob's scanner), and matching applies the same dot rule so a watcher filter cannot admit a file the scanner would never yield.
- **No Bun.* outside the seam** on the build path — the only exceptions are the HTTP dev server (`serve.ts`/`dev.ts`, repo tooling) and intentionally Bun-only harnesses (`sim-portability-check.ts`, `substrate-evaluation.ts`, `build-tsrx-browser.ts`).
- **`compileCorpus` lives outside `server/effects/`** (`server/corpus-compile.ts`): importing it must not drag the reactive machinery, the watchers, or a repo-shaped module graph. `server/effects/compile.ts` is the docs build's thin reactive wrapper around it.
- **Anchors are portable.** Module-relative roots use `dirname(fileURLToPath(import.meta.url))` wherever repo-anchoring is by design (the site config, the in-repo defaults); configuration-relative paths come from the resolved `CorpusConfig` — never from a module's location (the i18n lesson: `simulateCorpus` takes `root`, defaulting to the configured corpus root).
- **The gate:** `bun run check:portability` bundles the corpus build once and runs it under Bun, Node and Deno, diffing the emitted trees byte-for-byte. Module resolution rides the bundle (the source graph's extensionless imports are a bundler-facing fact the packaging step will normalize); what the check proves is that the build behaves identically once the graph is resolvable.

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
  │     ├─▶ sitemapEffect      → docs/sitemap.xml
  │     └─▶ llmsManifestEffect → docs/llms.txt
  → fullyProcessed (Task: Markdoc parse → transform → render → Shiki → post-processing)
        └─▶ pagesEffect        → docs/**/*.html (with alternate link in <head>, sidebar menu rendered per page)
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
| `pagesEffect` | `docsMarkdown.fullyProcessed` | `docs/**/*.html` | Layout templating (renders the sidebar menu per page via `menu()`) |
| `sitemapEffect` | `docsMarkdown.pageInfos` | `docs/sitemap.xml` | XML template |
| `mdMirrorEffect` | `docsMarkdown.processed` | `docs/**/*.md` | Regex tag stripping |
| `llmsManifestEffect` | `docsMarkdown.pageInfos` | `docs/llms.txt` | Template generation |
| `llmsFullManifestEffect` | `docsMarkdown.processed` | `docs/llms-full.txt` | Curated concatenation |
| `compileEffect` | `componentFiles.sources` | the configured output root, by default `server/generated/components/*` (gitignored) | Inlined component compiler (ADR 0024/0032) |

### Page-Occurrence Renderer (LT-194)

`renderPageOccurrences` (`server/effects/page-render.ts`) is not its own effect — `pagesEffect` calls it per locale inside `applyTemplate`, and `examplesEffect` calls it at the end of `processExample` (after demo-preview injection). It parses the assembled page HTML with parse5 (source-offset mode), replaces qualifying component occurrences with their generated server render, and splices the original string by offsets, so every byte outside a replaced occurrence — including all non-qualifying markup — survives verbatim.

An occurrence qualifies when **all three** hold:

1. The component is Folded-tier and declares the reserved `i18n` parameter — its server bytes actually depend on the locale (folded catalog words, materialized root `lang`). Simulated-tier occurrences stay authored (the realm cannot run per watch rebuild, ADR 0027 sub-design 10); a `lang`-arg component without `i18n` (`basic-number`) computes its value client-side and stays authored too.
2. The generated `<tag>.server.ts` module exports `argsFromAttrs` (emitted by `emit-server.ts` exactly when the component is statically renderable from attributes — see `LE_TRUC_COMPILER.md` §5.3). Occurrence `class`/`id` splice onto the rendered root like LT-090 compose-site discriminators.
3. The occurrence's effective locale resolves at build time: own `lang` attribute > nearest positional `[lang]` ancestor > the page tree's locale. The single-copy fragment trees (`examples/`) pass no page locale, so baseless occurrences there stay authored — client-upgraded, ADR 0030 s3's client-authored half.

Locale stays a build-time constant per rendered occurrence (the per-locale page loop fixes it before the pass), so the `Intl` fold and the census baselines are unaffected; there is no render cache (LT-193 posture). Generated modules are imported with mtime cache-busting so watch rebuilds serve fresh renders.

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
└── api/                  # TypeDoc-generated Markdown (intermediate)
    ├── classes/
    ├── functions/
    ├── type-aliases/
    └── variables/
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

Sections are delimited by `---` and headed with an H1. Blog posts, `about.md`, `examples.md`, and the per-symbol TypeDoc API files are excluded to keep the file focused on authoring guidance. Narrative pages have Markdoc tags stripped; standalone root docs pass through unchanged (they are plain Markdown). Standalone docs are read from `ROOT` through the runtime seam (`io.readTextFile`) inside the effect.

### Component Compiler (`compileEffect`)

**File:** `server/effects/compile.ts`  
**Depends on:** `componentFiles.sources` (the configured source globs — by default `examples/**/*.tsrx` and `examples/**/*.tsx`)  
**Outputs:** the configured output root — by default `server/generated/components/` — `<tag>.server.ts` (render function), `<tag>.client.ts` (generated `defineComponent` module), `<tag>.css` (verbatim tag-scoped CSS), and `registry.json`

**Corpus configuration (LT-255).** The globs and the output root are not this
repo's: they are a project's, read from a `le-truc.config.json` at its root,
and this repo's paths are the DEFAULTS — which is why the docs build carries
no config file. The surface, the field table, and the output-root depth rule
are documented in `server/compiler/LE_TRUC_COMPILER.md` § 7.1; the resolution
lives in `server/compiler/corpus-config.ts` (pure) and the globbing in
`server/corpus-sources.ts`, through the runtime seam since LT-267. The
compile itself lives in `server/corpus-compile.ts` — deliberately outside
`server/effects/`, so a consumer imports the build path without the reactive
machinery — and `server/effects/compile.ts` (`compileEffect`) is the docs
build's reactive wrapper around it.

The inlined TSRX compiler (ADR 0024) compiles isomorphic single-file `.tsrx` components — server args, signals, `expose()`, markup, event handlers, and scoped styles in one source — into the split compiler's two halves. The server module re-declares the `@{ }` setup against the runtime harness (`server/compiler/runtime.ts`) and renders HTML strings; the client module is a generated factory importing solely from `@zeix/le-truc`. Extension activation is declared as `export const config` in the source; the compiler validates it, auto-imports the extension factories, and carries `expose()`/`defineMethod()` as ambients. `bun run build:cem` runs `scripts/build-corpus.ts` before `cem analyze` so `@zeix/cem-plugin-le-truc` reads the generated clients unchanged. Errors fail the build; `@for` over a non-List reactive source logs `LTC001` and skips the file.

Template control flow follows the pinned `@tsrx/core` directive grammar: `@if`/`@switch` render server-known branches and address them client-side through union selectors; `@try`/`@catch` is a render-time error boundary (arms render into isolated buffers so a mid-arm throw cannot leak partial markup); `@for` over a `createList` lowers to keyed in-place items reconciled client-side by `reconcile()`. Dynamic rendering is `truc:html={dataRef}`, rendered through `sanitizeHtml` (scripts, `on*` attributes, and unsafe URL schemes stripped). Constructs the pinned parser cannot parse in that position fail with a parse-error hint; `@pending` async arms are gated until async server rendering exists.

The compiler lives in `server/compiler/`, one concern per file, wired together by `compiler.ts` (`compileSource`). `core.ts` is the only module importing `@tsrx/core` values; `ir.ts` holds the shared IR types; `lower-template.ts` lowers JSX/`@if`/`@switch`/`@try`/`@for` into IR; `classify-attributes.ts`, `infer-type.ts`, `config.ts`, and `imports.ts` handle attributes, signal typing, `export const config`, and import resolution; `analysis/{plan,selectors,naming,harvest,loops,effects}.ts` produce the client emission plan; `emit-server.ts`/`emit-client.ts` render the artifacts. See `server/compiler/LE_TRUC_COMPILER.md` for the full module inventory. Golden tests in `server/tests/compiler/` pin server renders, CSS bytes, client snapshots (regenerate with `UPDATE_SNAPSHOTS=1 bun test server/tests/tsrx`), diagnostics, and language-feature gates.

#### Server Simulation driver (`server/compiler/sim/`, ADR 0027, ADR 0035)

Renders initial HTML by *executing* the generated client module against jsdom instead of evaluating it syntactically. The build never imports it directly: it goes through the **seam** (ADR 0035 s3–s4), and the driver is reached by resolution, not configuration.

- **`server/compiler/simulation/contract.ts`** — the seam. `(markup, component, locale, options) → (html, diagnostics)`, with no `window`, `Document` or substrate type crossing it, plus `SIMULATION_SEAM_VERSION` and the `SimulationProvider` handshake. It is a standalone module: nothing compiler-side ever reaches behind it, which is what lets a consumer who skips the optional jsdom dependency still typecheck (`bun run check:nosubstrate`, ADR 0034 s5).
- **`server/compiler/simulation/capabilities.ts`** — the classifier-facing half of the old patch table: `UNANSWERABLE_GLOBALS` (the names the realm stubs or closes) and `CAPABILITY_PATCHES` (member reads the realm answers *wrong* — layout geometry, and the `ElementInternals` members jsdom does not implement). `attachInternals()` itself is deliberately left alone: jsdom's skeletal object reaches the library and `bindAria()` binds the host content attribute the served HTML carries. `tier.ts` reads only this, so classification and the census work with no substrate installed.
- **`server/compiler/simulation/resolve.ts`** — activation is installation. The driver specifier is held in a variable so the typechecker does not follow it; absence answers `null` and a version mismatch throws. Absence is narrowly construed (`isSubstrateAbsence`): only a module-resolution failure naming the driver or its substrate counts, so a driver present but broken — an init throw, a missing transitive dependency — surfaces with its real cause.
- **`patch-table.ts`** — the applier-facing half: `REALM_GLOBALS` forces DOM constructors from the jsdom window onto `globalThis` (some runtimes ship natives that would otherwise shadow the realm and break `instanceof`); `STUB_GLOBALS` gives absent constructors inert no-ops; `NETWORK_GLOBALS` replaces `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource`/`Request`/`navigator.sendBeacon` with never-settling no-ops so a build can never depend on the network. A test pins it against `UNANSWERABLE_GLOBALS`.
- **`classifications.ts`** — the standing notices *this substrate* emits (`CLASSIFIED_DIAGNOSTICS`), published through the provider. The report channel itself is compiler-side, in `server/compiler/build-report.ts`.
- **`realm.ts`** — the uniform applier, in two phases because a client module registers its element as an import side effect: `load()` imports with a recording `customElements` that captures `define()` calls; `render()` seeds the page's locale onto `<html lang>` (LT-172, so `getLocale()`'s ancestor walk resolves the page's answer rather than the `'en'` fallback), parses the SSR'd markup, replays the definitions so the upgrade runs, and serializes. `dispose()` restores every touched global. jsdom's `virtualConsole`, network attempts, unhandled rejections, and contained throws all land in `diagnostics`, attributed to the component whose window was open.
- **`boundary.ts`** — `runSynchronously()` asserts the instantiate-to-serialize window never awaits, so the compiler (not microtask timing) decides which `@try` arm ships.

**`server/effects/simulate.ts`** is the build's entry to the driver, called from `build.ts` after the compiler effect is ready. It reads the registry's post-contamination tier and opens a realm **only** for the Simulated tier — a Folded-tier component renders through `emit-server.ts` and the value harness, and a Static-tier component renders its skeleton, so a realm changes neither output (ADR 0029). `assertSimulatedTier()` fails the build on any attempt to simulate another tier, because that waste has no output symptom. Each Simulated-tier component renders once per top-level occurrence of its tag in its authored demo markup (`examples/**/<tag>.html`, resolved against the configured corpus **root** — an option, not a module anchor, LT-267), once per locale. The realm LOADS more than it renders: each subject's client module plus the transitive `composesTags` closure over the registry, children-first and skipping tags already recorded, whatever the children's tier (LT-188) — a server-spliced child its parent never imports would otherwise stay undefined and render un-upgraded. Loading a Folded-tier child defines its tag; it never renders it, so the tier invariant holds. The realm is created and disposed exactly once per build process, never between renders. `reportDiagnostics()` (in `server/compiler/build-report.ts`, against the classifications the resolved driver published) then partitions the realm's diagnostics: classified entries are listed with their reason, and one unclassified entry fails the build and names the component. A pass that throws before reaching the report (a `load()` assertion, an importer error) still prints the diagnostics captured so far before rethrowing. The pass runs for a one-shot `build:docs` only — a watch rebuild re-imports the same generated client paths, and one module cache per process makes the second load record no definitions (ADR 0027 sub-design 10). When the resolver answers `null` — jsdom is an optional peer dependency (ADR 0034 s5), so a build may have no substrate installed — the pass never opens a realm: it routes the Simulated-tier components Static, appends an `unavailable-substrate` routing signal recording why, rewrites `generated/registry.json` so the tier census reports the outcome, logs the census rows, and stays green — the components' initial markup is the skeleton. A substrate present but broken is the opposite outcome: the resolver throws, failing the build with the real cause. The registry rewrite happens only on that reroute — a substrate-present build never touches the written registry — so `registry.json` reflects the routing outcome of the last one-shot build.

`bun run check:sim` (`scripts/sim-portability-check.ts`) renders the ADR's stress case, bundles its client module, runs it under every runtime on PATH via `scripts/sim-portability-probe.ts`, and diffs the serialized HTML; it exits non-zero on disagreement.

`bun run eval:substrate` (`scripts/substrate-evaluation.ts`) runs the ADR spike checklist — a DOMPurify verification, the stress case, and a render-cost benchmark at built-docs scale — on jsdom and, if installed, `happy-dom` (`bun add -d happy-dom`; not a dependency by default, since the evaluation disqualified it as a default substrate). The substrate-parameterized driver half lives in `scripts/lib/substrate-probe.ts`, reusing the production patch table; `server/compiler/sim/` itself stays jsdom-only. Bench phases run as subprocesses that print JSON and hard-exit without disposing the realm — disposal is end-of-process by design.

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
| `GET /` | 302 redirect to the default locale's index (`Accept: text/markdown` → source) | Inline |
| `GET /index.html` | The root redirect stub the build emits for static hosts | `docs/index.html` |
| `GET /api/status` | Health check (`"OK"`) | Inline |
| `GET /ws` | WebSocket upgrade (HMR) | In-memory |
| `GET /api/:category/:page` | API doc fragment (locale-independent, at the docs root) | `docs/api/<category>/<page>` |
| `GET /assets/*` | Static assets | `docs/assets/` |
| `GET /examples/:component` | Pre-built example HTML | `docs/examples/` |
| `GET /sources/:file` | Source code fragments | `docs/sources/` |
| `GET /test/:component/mocks/:mock` | Test mock files | `examples/<component>/mocks/` |
| `GET /test/:component/surface.js?surface=ts\|tsrx\|tsx` | Layout bundle with the component's client swapped for one spelling | `examples/main.ts` graph + the twin, canonical or `variants/` client |
| `GET /test/:component` | Component test page; `?surface=` (or `TEST_SURFACE`) selects the spelling | `docs-src/layouts/test.html` + `examples/<component>/<component>.html` |
| `GET /:locale/blog/:slug` | Blog post page; `<slug>.md` serves the markdown mirror next to it | `docs/<locale>/blog/<slug>.html\|.md` |
| `GET /:locale/:page` | Documentation page inside a locale tree | `docs/<locale>/<page>` |
| `GET /:locale` | That locale's index page | `docs/<locale>/index.html` |
| `GET /favicon.ico` | Favicon | `docs/favicon.ico` |

Pages live under `docs/<locale>/` — one complete tree per locale (LT-174) — while the api/, examples/ and sources/ fragment trees stay single-copy at the docs root. `GET /:locale/:page` redirects 301 extensionless URLs (`/en/guide`) to the matching `<page>.html` when it exists and 404s otherwise. `Accept: text/markdown` returns raw `.md` source from `docs-src/pages/` on `/` and `/:locale/:page`; blog posts serve their built markdown mirror directly at `/<locale>/blog/<slug>.md`. `handleStaticFile` 404s on directory paths generally, so no route can attempt `sendfile` on a directory.

**Component test surfaces** (LT-284, ADR 0039 s2). A variant set carries up to three spellings of one tag; `?surface=ts|tsrx|tsx` on `/test/:component` swaps the page's `{{ test-script }}` from `/assets/main.js` to `surface.js`. That bundle is the full `examples/main.ts` graph with the component's canonical client emptied and one module appended: the hand-written twin (`ts`), the canonical client when that surface is the registry's selected member, or else `variants/<tag>.<surface>.client.ts`. The tag is therefore defined exactly once. A surface the component does not carry is a 404, an unknown one a 400. With no query, the `TEST_SURFACE` env var applies. Specs hard-code `/test/<tag>`, so `scripts/test-variants.ts` uses the env var: it builds once and, per surface, starts `serve.ts` with `TEST_SURFACE` set, then runs the specs of the folders that carry that surface. It refuses to start while port 3000 is taken, because Playwright's `reuseExistingServer` would test the default page.

**Legacy root-level URLs** (`/guide.html`, `/blog/<slug>`, …) 404 by design (LT-198 ruling): a redirect map in `serve.ts` would not reach the static host that actually serves the site, and the locale layout is unreleased, so there is no population of broken external links yet. Only `/` got the stub treatment, because it is the URL people actually type. Pinned by the `legacy root URLs` tests in `server/tests/serve.test.ts`.

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

All six layouts share a persistent left sidebar + main two-column shell: a slimmed `<header>` top bar (title, `#sidebar-toggle` button, the error `card-callout`) followed by a `.docs-body` wrapper containing the `{{ menu }}` placeholder and the layout's existing `<main class="content-grid">` (each layout's own secondary navigation — `api.html`'s `.api-breadcrumb`/`.api-nav`, `overview.html`'s `.overview-pagination`, content-level `{% listnav %}` — is unchanged, nested inside `.docs-main`/`<main>` alongside the sidebar). `{{ menu }}` is populated per page by `pagesEffect` (see below), not by an include. The toggle button (`id="sidebar-toggle"`, `aria-controls="sidebar"`) and the sidebar root (`<section-menu id="sidebar">`, rendered by `menu()`) are the markup contract for `section-menu`'s mobile drawer behavior — interactivity itself lives in `examples/section/menu/`.

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
| `menu.ts` | `menuItem()`, `menu()`, `groupOf()` | `pagesEffect` (rendered per page inside `applyTemplate()`) |
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

All path constants are **absolute paths** computed from `ROOT` (this module's directory's parent, anchored portably per LT-267) at module load time, so the server never needs to `process.chdir`.

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
| `STATIC_DIR` | `docs-src/static/` | Static assets copied verbatim by `staticAssetsEffect` |
| `OUTPUT_DIR` | `docs/` | Final build output |
| `ASSETS_DIR` | `docs/assets/` | Built assets |
| `EXAMPLES_DIR` | `docs/examples/` | Built example pages |
| `SOURCES_DIR` | `docs/sources/` | Highlighted source fragments |
| `TEST_DIR` | `docs/test/` | Copied mock files for component tests |
| `SITEMAP_FILE` | `docs/sitemap.xml` | SEO sitemap |
| `LLMS_TXT_FILE` | `docs/llms.txt` | AI crawler entry point |

### Page Ordering

`PAGE_ORDER` controls navigation menu order:
`index`, `getting-started`, `components`, `props`, `effects`, `styling`, `accessibility`, `extensions`, `data-flow`, `lists`, `async`, `context`, `examples`, `api`, `blog`, `about`

### Sidebar Menu Groups

`MENU_GROUPS` groups every root page under a sidebar heading, in sidebar order. The two guide chapters (see below) double as menu groups — same title, same page list as `CHAPTERS` — interleaved with sidebar-only groups ("Get Started", "Reference", "Community") that carry no stepper.

- **Sidebar rendering:** `menu()` in `templates/menu.ts` sorts root pages by `PAGE_ORDER`, then inserts one `<li class="group" role="presentation">` heading before the first member of each `MENU_GROUPS` group present in that sorted list. It's called per page inside `applyTemplate()` (`effects/pages.ts`), which passes the current page's slug (or its `section`, for pages that live under a root page — blog posts, API symbols) so the matching item gets `aria-current="page"` and `class="active"`. Sidebar layout/styling lives in `examples/section/menu/section-menu.css`.
- **Constraint:** every `PAGE_ORDER` slug must belong to exactly one `MENU_GROUPS` group, and each group's members must be contiguous in `PAGE_ORDER` — the group heading renders at the position of the first present member. Covered by `server/tests/config.test.ts`.

### Guide Chapters

`CHAPTERS` groups guide pages into chapters with a prev/next stepper (the sidebar heading for the same pages comes from `MENU_GROUPS`, above — the two configs stay in sync by construction: each guide chapter's `MENU_GROUPS` entry reuses `CHAPTERS[i].title`/`.pages` directly):

- **Chapter stepper:** `getChapterVars()` in `effects/pages.ts` computes a `chapter-nav` template variable for every root page that belongs to a chapter. `chapterNav()` in `templates/chapter-nav.ts` renders `<nav class="content chapter-nav">` with "Part k of n" and prev/next links; the `{{ chapter-nav }}` placeholder in `layouts/page.html` collapses to nothing for non-member pages. Missing siblings (a chapter page absent from the build) are skipped; the stepper collapses entirely when no links remain. Styling lives in `examples/section/menu/chapter-nav.css`.

Constraint: member slugs must appear in `PAGE_ORDER`, and each chapter's members should be contiguous in it — the same contiguity constraint `MENU_GROUPS` has.

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

Blog posts live in `docs-src/pages/blog/` (`YYYY-MM-DD-slug.md` naming) and are processed by the existing `docsMarkdown` signal and `pagesEffect` — no dedicated signal or effect. `PageMetadata` carries blog-only optional fields (`date`, `author`, `author-avatar`, `modified-date`, `tags`); `pagesEffect` injects derived template variables (`published-date`, `modified-date`, `reading-time`, `blog-tags`, `author-avatar`, `prev-post(-title)`, `next-post(-title)`) via `applyTemplate`'s `extraReplacements` parameter when `section === 'blog'`. The blog overview page (`blog.md`, `page.html` layout) has its body replaced with 3 latest-post excerpt cards (`<card-blogpost>`) built directly by `generateBlogExcerpts()` in `pages.ts`, followed by a `<module-blogarchive>` of the remaining posts, grouped by year into `<details>`/`<summary>` sections (current year open), built by `generateBlogArchive()` (both not via a Markdoc tag); individual posts use the `blog.html` layout, which hardcodes a `<basic-blogmeta>` element filled in via `{{ published-date }}`-style template variables. Routing: `GET /:locale/blog/:slug` in `serve.ts` serves `docs/<locale>/blog/<slug>.html`; the markdown mirror written next to it is served at `/<locale>/blog/<slug>.md` (LT-198).
