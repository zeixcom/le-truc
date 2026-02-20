# Test Plan — Server & Build System

Comprehensive test plan for `server/` to prevent regressions. Tests use **Bun's built-in test runner** (`bun:test`). Each section maps to a source module, lists what to test, and specifies concrete test cases.

Reference: [SERVER.md](./SERVER.md) for architecture details.

---

## Scope

### What to test

- **All pure functions** — deterministic input/output, no side effects (highest value, lowest cost)
- **Template generators** — tagged template literals that produce HTML, XML, CSS, JS strings
- **Markdoc helpers and schemas** — AST transformation, validation, rendering
- **File signal pipeline** — frontmatter extraction, metadata, Markdoc processing
- **IO utilities** — file hashing, path manipulation, safe writes
- **HTTP server routes** — status codes, content types, HMR injection, layout selection
- **Build orchestration** — effect registration, cleanup, error handling

### What NOT to test (out of scope)

- Third-party libraries (`@markdoc/markdoc`, `shiki`, `@zeix/cause-effect` internals)
- Playwright browser tests (already exist in `examples/`)
- Production deployment infrastructure
- TypeDoc output format (owned by `typedoc-plugin-markdown`)

### Test categories

| Category | Mocking | File I/O | Network | Typical runtime |
|---|---|---|---|---|
| **Unit** | None | No | No | < 5 ms per test |
| **Integration** | Minimal | Temp dirs | No | < 500 ms per test |
| **Server** | Build pipeline | Temp dirs | localhost HTTP | < 2 s per test |

---

## Conventions

### File naming and location

```text
server/tests/
├── io.test.ts                    # IO utilities
├── config.test.ts                # Configuration constants
├── templates/
│   ├── utils.test.ts             # Template utilities
│   ├── menu.test.ts              # Menu template
│   ├── sitemap.test.ts           # Sitemap template
│   ├── fragments.test.ts         # Tab group fragments
│   ├── performance-hints.test.ts # Preload hints
│   ├── service-worker.test.ts    # Service worker generation
│   └── hmr.test.ts               # HMR client script
├── markdoc-helpers.test.ts       # Markdoc helper utilities
├── schema/
│   ├── callout.test.ts           # Callout schema
│   ├── fence.test.ts             # Fence (code block) schema
│   ├── heading.test.ts           # Heading schema
│   ├── hero.test.ts              # Hero schema
│   ├── demo.test.ts              # Demo schema
│   ├── listnav.test.ts           # Listnav schema
│   ├── carousel.test.ts          # Carousel schema
│   └── section.test.ts           # Section schema
├── file-signals.test.ts          # Signal pipeline & frontmatter
├── file-watcher.test.ts          # File watcher
├── serve.test.ts                 # HTTP server routes
├── build.test.ts                 # Build orchestration
└── effects/
    ├── pages.test.ts             # Page generation effect
    ├── menu.test.ts              # Menu effect
    ├── sitemap.test.ts           # Sitemap effect
    ├── examples.test.ts          # Examples effect
    ├── sources.test.ts           # Sources effect
    └── service-worker.test.ts    # Service worker effect
```

### Running tests

Add to `package.json` scripts:

```json
{
  "test:server": "bun test server/tests/",
  "test:server:unit": "bun test server/tests/ --grep 'unit'",
  "test:server:integration": "bun test server/tests/ --grep 'integration'",
  "test:server:watch": "bun test server/tests/ --watch"
}
```

### Shared test helpers

Create `server/tests/helpers.ts` with:

- `createTempDir()` / `cleanupTempDir(path)` — isolated temp directories for file I/O tests
- `createMockFileInfo(overrides)` — factory for `FileInfo` objects
- `createMockPageInfo(overrides)` — factory for `PageInfo` objects
- `parseMarkdocToHtml(markdown, config?)` — shorthand for parse → validate → transform → render
- `stripWhitespace(html)` — normalize whitespace for HTML comparison
- `createTestServer(options?)` — start an isolated `Bun.serve()` on a random port, return `{ url, fetch, close }`

---

## Test Specifications

---

### 1. `io.ts` — IO Utilities

**File:** `server/tests/io.test.ts`
**Category:** Unit + Integration

#### 1.1 `calculateFileHash`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Returns consistent hash for same content | `"hello world"` twice | Same 16-char hex string both times |
| 2 | Returns different hash for different content | `"hello"` vs `"world"` | Different strings |
| 3 | Returns 16-character hex string | Any string | Matches `/^[a-f0-9]{16}$/` |
| 4 | Handles empty string | `""` | Valid 16-char hex string |
| 5 | Handles unicode content | `"こんにちは"` | Valid 16-char hex string |

#### 1.2 `getFilePath`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Joins two path segments | `"docs", "index.html"` | `"docs/index.html"` |
| 2 | Joins multiple segments | `"docs", "api", "functions", "foo.md"` | `"docs/api/functions/foo.md"` |
| 3 | Handles trailing slash | `"docs/", "file.html"` | `"docs/file.html"` |

#### 1.3 `getRelativePath`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Returns relative path within base | `"docs-src/pages", "docs-src/pages/index.md"` | `"index.md"` |
| 2 | Returns nested relative path | `"docs-src/pages", "docs-src/pages/api/foo.md"` | `"api/foo.md"` |
| 3 | Returns null for path outside base | `"docs-src/pages", "/etc/passwd"` | `null` |

#### 1.4 `createFileInfo` (integration)

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Reads existing file | Write temp file, call with its path | `exists: true`, correct `content`, `hash`, `size > 0` |
| 2 | Returns fallback for missing file | Non-existent path | `exists: false`, `content: ""`, `size: 0` |

#### 1.5 `writeFileSafe` (integration)

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Writes file to existing directory | Temp dir + content | File exists with correct content, returns `true` |
| 2 | Creates parent directories | Nested non-existent path | Directories created, file written, returns `true` |
| 3 | Overwrites existing file | Write twice to same path | Second content persists |

#### 1.6 `getCompressedBuffer`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Returns Brotli when accepted | `acceptsBrotli: true` | `encoding: "br"`, content is Buffer |
| 2 | Falls back to Gzip | `acceptsBrotli: false, acceptsGzip: true` | `encoding: "gzip"` |
| 3 | Returns identity when no compression | Both false | `encoding: "identity"`, same buffer |

#### 1.7 `isPlaywrightRunning`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Returns true when PLAYWRIGHT env is set | `process.env.PLAYWRIGHT = "1"` | `true` |
| 2 | Returns false when no Playwright env | Clear all Playwright env vars | `false` |

---

### 2. `config.ts` — Configuration

**File:** `server/tests/config.test.ts`
**Category:** Unit

| # | Test | Expected |
|---|------|----------|
| 1 | `PAGE_ORDER` contains all known pages | Includes `"index"`, `"getting-started"`, `"components"`, `"styling"`, `"data-flow"`, `"examples"`, `"api"`, `"about"` |
| 2 | `PAGE_ORDER` has no duplicates | `new Set(PAGE_ORDER).size === PAGE_ORDER.length` |
| 3 | `ROUTE_LAYOUT_MAP` maps API sub-paths to `"api"` | `"/api/classes/"`, `"/api/functions/"`, `"/api/type-aliases/"`, `"/api/variables/"` all → `"api"` |
| 4 | `ROUTE_LAYOUT_MAP` has default fallback | `"/"` maps to `"page"` |
| 5 | Directory constants are relative paths | All `*_DIR` constants start with `"./"` |
| 6 | `MIME_TYPES` covers all served extensions | Has entries for `html`, `css`, `js`, `json`, `svg`, `woff2` |

---

### 3. `templates/utils.ts` — Template Utilities

**File:** `server/tests/templates/utils.test.ts`
**Category:** Unit

#### 3.1 Tagged template literals

| # | Test | Expected |
|---|------|----------|
| 1 | `html` joins strings and values | `html\`<p>${"text"}</p>\`` → `"<p>text</p>"` |
| 2 | `html` escapes non-string values | `html\`<p>${42}</p>\`` → `"<p>42</p>"` |
| 3 | `html` flattens arrays | `html\`<ul>${["<li>a</li>", "<li>b</li>"]}</ul>\`` → contains both `<li>` |
| 4 | `html` handles null/undefined gracefully | `html\`<p>${null}</p>\`` → `"<p></p>"` |
| 5 | `xml` escapes XML entities | Value with `&`, `<`, `>`, `"`, `'` → all escaped |
| 6 | `css` passes values through unescaped | `css\`.foo { color: ${"red"} }\`` → contains `red` |
| 7 | `js` passes values through | `js\`const x = ${42};\`` → contains `42` |

#### 3.2 `escapeHtml`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Escapes ampersand | `"A & B"` | `"A &amp; B"` |
| 2 | Escapes angle brackets | `"<script>"` | `"&lt;script&gt;"` |
| 3 | Escapes quotes | `'She said "hi"'` | `'She said &quot;hi&quot;'` |
| 4 | Leaves safe text unchanged | `"Hello World"` | `"Hello World"` |

#### 3.3 `escapeXml`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Escapes single quote as `&apos;` | `"it's"` | `"it&apos;s"` |
| 2 | Escapes all XML special chars | `'<"&\'>'` | All entities present |

#### 3.4 `generateSlug`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Lowercases text | `"Hello World"` | `"hello-world"` |
| 2 | Replaces spaces with hyphens | `"foo bar baz"` | `"foo-bar-baz"` |
| 3 | Strips special characters | `"What's this?!"` | `"whats-this"` |
| 4 | Collapses multiple hyphens | `"foo---bar"` | `"foo-bar"` |
| 5 | Handles empty string | `""` | `""` |

#### 3.5 `createOrderedSort`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Sorts by order array | Items `["b", "a", "c"]`, order `["a", "b", "c"]` | `["a", "b", "c"]` |
| 2 | Ordered items come before unordered | Order `["a"]`, items `["z", "a"]` | `"a"` first |
| 3 | Unordered items sort alphabetically | Order `[]`, items `["c", "a", "b"]` | `["a", "b", "c"]` |

#### 3.6 `getResourceType`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | CSS file | `"main.css"` | `"style"` |
| 2 | JS file | `"main.js"` | `"script"` |
| 3 | Font file | `"font.woff2"` | `"font"` |
| 4 | Unknown extension | `"data.xyz"` | `"fetch"` |

#### 3.7 `validateHtml`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Valid HTML passes | `"<div><p>Hi</p></div>"` | `{ valid: true, errors: [] }` |
| 2 | Mismatched tags fail | `"<div><p>Hi</div>"` | `valid: false` |

#### 3.8 Other utilities

| # | Test | Expected |
|---|------|----------|
| 1 | `when(true, fn)` returns fn result | `"yes"` |
| 2 | `when(false, fn)` returns `""` | `""` |
| 3 | `unless(false, fn)` returns fn result | `"yes"` |
| 4 | `fragment` joins non-empty strings | `fragment("a", "", "b")` → `"ab"` |
| 5 | `indent` adds spaces to non-empty lines | Each line gets `n` spaces prepended |
| 6 | `minify` collapses whitespace | `"> \n <"` → `"><"` |

---

### 4. `templates/menu.ts` — Menu Template

**File:** `server/tests/templates/menu.test.ts`
**Category:** Unit

| # | Test | Expected |
|---|------|----------|
| 1 | `menuItem` renders an `<li>` with link, icon, title, and description | Contains `<a href="...">`, emoji span, `<strong>`, `<small>` |
| 2 | `menu` wraps items in `<section-menu>` with `<nav>` and `<ol>` | Output starts with `<section-menu>`, contains `<ol>` |
| 3 | `menu` sorts pages by `PAGE_ORDER` | Given `["about", "index"]`, `"index"` appears first |
| 4 | `menu` filters out pages with a `section` property | Page with `section: "api"` is excluded |
| 5 | `menu` renders empty `<ol>` for no root pages | Still produces valid `<section-menu>` structure |

---

### 5. `templates/sitemap.ts` — Sitemap Template

**File:** `server/tests/templates/sitemap.test.ts`
**Category:** Unit

| # | Test | Expected |
|---|------|----------|
| 1 | `sitemapUrl` generates `<url>` with `<loc>`, `<lastmod>`, `<priority>` | Contains all three child elements |
| 2 | `sitemapUrl` gives priority `1.0` to `index.html` | `<priority>1.0</priority>` |
| 3 | `sitemapUrl` gives priority `0.8` to root pages | Non-index, no section → `0.8` |
| 4 | `sitemapUrl` gives priority `0.5` to default pages | Page with section → `0.5` |
| 5 | `sitemap` generates valid XML with `<?xml` declaration | Starts with `<?xml version=` |
| 6 | `sitemap` includes `xmlns` on `<urlset>` | Contains sitemap namespace URL |
| 7 | `sitemap` includes all provided pages | N pages → N `<url>` elements |

---

### 6. `templates/fragments.ts` — Tab Group Fragments

**File:** `server/tests/templates/fragments.test.ts`
**Category:** Unit

| # | Test | Expected |
|---|------|----------|
| 1 | `tabButton` renders `role="tab"` with correct `aria-controls` | Contains `role="tab"`, `aria-controls="panel_..."` |
| 2 | `tabButton` sets `aria-selected="true"` for selected panel | Selected panel has `aria-selected="true"` |
| 3 | `tabButton` sets `tabindex="-1"` for unselected panels | Unselected has `tabindex="-1"` |
| 4 | `tabPanel` renders `role="tabpanel"` | Contains `role="tabpanel"` |
| 5 | `tabPanel` adds `hidden` attribute for non-selected panels | Non-selected panel includes `hidden` |
| 6 | `tabGroup` wraps buttons in `role="tablist"` and panels below | Contains both `tablist` div and `tabpanel` divs |
| 7 | `tabGroup` returns fallback message for empty panels | Contains `"No component files available"` |
| 8 | `validatePanels` rejects empty array | Errors include `"No panels provided"` |
| 9 | `validatePanels` rejects multiple selected panels | Errors include `"Multiple panels are selected"` |
| 10 | `validatePanels` rejects duplicate panel types | Errors include `"Duplicate panel type"` |

---

### 7. `templates/performance-hints.ts` — Performance Hints

**File:** `server/tests/templates/performance-hints.test.ts`
**Category:** Unit

| # | Test | Expected |
|---|------|----------|
| 1 | `preloadLink` generates `<link rel="preload">` with correct `as` | CSS → `as="style"`, JS → `as="script"` |
| 2 | `preloadLink` adds `crossorigin` for font files | `.woff2` URL → contains `crossorigin` |
| 3 | `preloadLink` omits `crossorigin` for non-font files | `.css` URL → no `crossorigin` |
| 4 | `performanceHints` returns empty string for empty array | `performanceHints([])` → `""` |
| 5 | `performanceHints` returns all preload links | 3 URLs → 3 `<link>` elements |

---

### 8. `templates/service-worker.ts` — Service Worker

**File:** `server/tests/templates/service-worker.test.ts`
**Category:** Unit

| # | Test | Expected |
|---|------|----------|
| 1 | `serviceWorker` generates JS with `CACHE_NAME` | Contains `const CACHE_NAME =` |
| 2 | `serviceWorker` includes versioned asset URLs | Contains `/assets/main.{cssHash}.css` and `.js` |
| 3 | `serviceWorker` includes install, activate, and fetch listeners | Contains all three `addEventListener` calls |
| 4 | `minifiedServiceWorker` removes `console.log` statements | No `console.log` in output |
| 5 | `validateServiceWorkerConfig` accepts valid config | `{ cssHash: "abcdef1234567890", jsHash: "1234567890abcdef" }` → `valid: true` |
| 6 | `validateServiceWorkerConfig` rejects missing hashes | `{ cssHash: "", jsHash: "" }` → `valid: false` |
| 7 | `validateServiceWorkerConfig` rejects non-hex hashes | `{ cssHash: "not-hex!", jsHash: "valid123" }` → errors |

---

### 9. `templates/hmr.ts` — HMR Client

**File:** `server/tests/templates/hmr.test.ts`
**Category:** Unit

| # | Test | Expected |
|---|------|----------|
| 1 | `hmrClient` generates self-executing function | Starts with `(function` or equivalent IIFE pattern |
| 2 | `hmrClient` includes WebSocket connection to `/ws` | Contains `'/ws'` |
| 3 | `hmrClient` includes reconnection logic | Contains `reconnectAttempts` and `scheduleReconnect` |
| 4 | `hmrClient` respects `maxReconnectAttempts` config | Config value `3` → contains `3` in reconnect check |
| 5 | `hmrClient` includes error overlay functions | Contains `showBuildError` and `hideBuildError` |
| 6 | `hmrClient` exposes `window.__HMR__` when logging enabled | `enableLogging: true` → contains `__HMR__` |
| 7 | `hmrClient` omits `console.log` when logging disabled | `enableLogging: false` → no `console.log` |
| 8 | `hmrScriptTag` wraps client in `<script>` tag | Starts with `<script>`, ends with `</script>` |

---

### 10. `markdoc-helpers.ts` — Markdoc Utilities

**File:** `server/tests/markdoc-helpers.test.ts`
**Category:** Unit

#### 10.1 Attribute classes

| # | Test | Expected |
|---|------|----------|
| 1 | `ClassAttribute.validate` accepts string | No errors |
| 2 | `ClassAttribute.validate` accepts shorthand object | No errors |
| 3 | `ClassAttribute.transform` converts shorthand to string | `{ info: true, tip: false }` → `"info"` |
| 4 | `IdAttribute.validate` accepts string | No errors |
| 5 | `IdAttribute.validate` rejects number | Returns error |
| 6 | `CalloutClassAttribute.validate` accepts `"info"` | No errors |
| 7 | `CalloutClassAttribute.validate` rejects `"invalid"` | Returns error with allowed values |
| 8 | `CalloutClassAttribute.transform` extracts valid class from shorthand | `{ danger: true, other: true }` → `"danger"` |

#### 10.2 Node utilities

| # | Test | Expected |
|---|------|----------|
| 1 | `extractTextFromNode` extracts text from `text` node | Returns `content` attribute |
| 2 | `extractTextFromNode` concatenates nested children | Paragraph with multiple text children → joined |
| 3 | `extractTextFromNode` skips lists when `skipLists=true` | Item with nested list → only direct text |
| 4 | `splitContentBySeparator` splits on `hr` | 3 sections separated by 2 `hr` nodes → 3 arrays |
| 5 | `splitContentBySeparator` handles no separators | All nodes in one section |

#### 10.3 ID / Slug generation

| # | Test | Expected |
|---|------|----------|
| 1 | `generateId` with text produces deterministic slug | `"Hello World"` → `"hello-world"` |
| 2 | `generateId` without text produces random 7-char string | Matches `/^[a-z0-9]{7}$/` |
| 3 | `generateId` decodes HTML entities | `"A &amp; B"` → `"a--b"` or similar |
| 4 | `generateSlug` matches `templates/utils.ts` `generateSlug` | Same input → same output for both functions |

#### 10.4 Tag helpers

| # | Test | Expected |
|---|------|----------|
| 1 | `createAccessibleHeading` returns Tag with `id` and anchor | Tag name `h2`, has `id`, child anchor with `href="#slug"` |
| 2 | `createAccessibleHeading` respects level parameter | Level 3 → `h3` tag |
| 3 | `createVisuallyHiddenHeading` has `visually-hidden` class | Attributes include `class: "visually-hidden"` |
| 4 | `createNavigationButton("prev")` has correct aria-label | `aria-label: "Previous"` |
| 5 | `createNavigationButton("next")` has correct aria-label | `aria-label: "Next"` |
| 6 | `createTabButton` sets correct ARIA attributes | Has `role: "tab"`, `aria-controls`, `aria-selected` |

#### 10.5 `html` tagged template literal (Markdoc version)

| # | Test | Expected |
|---|------|----------|
| 1 | Single element → returns `Tag` | `html\`<div>hello</div>\`` → Tag with name `"div"` |
| 2 | Nested elements → correct children | `html\`<div><p>hi</p></div>\`` → div Tag with p Tag child |
| 3 | Attributes are parsed | `html\`<div class="foo" id="bar"></div>\`` → attributes `{ class: "foo", id: "bar" }` |
| 4 | String interpolation in children | `html\`<p>${"text"}</p>\`` → child is `"text"` |
| 5 | Array interpolation flattens | `html\`<ul>${[tag1, tag2]}</ul>\`` → both tags in children |
| 6 | Self-closing elements work | `html\`<input type="text" />\`` → Tag with empty children |
| 7 | Invalid HTML returns error callout | `html\`<div><p></div>\`` → Tag with name `"card-callout"` |

---

### 11. Markdoc Schemas — `schema/*.markdoc.ts`

**Category:** Unit

For each schema, test the `transform` function by parsing a minimal Markdoc document containing the tag, then validating the rendered HTML output.

#### 11.1 `fence.markdoc.ts`

**File:** `server/tests/schema/fence.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Renders `module-codeblock` wrapper | Output tag name is `module-codeblock` |
| 2 | Sets `language` attribute from info string | ` ```ts ` → `language="ts"` |
| 3 | Parses filename from `lang#filename` syntax | ` ```html#index.html ` → `<span class="file">index.html</span>` in meta |
| 4 | Includes copy button | Children contain `basic-button` Tag with class `copy` |
| 5 | Adds `collapsed` attribute for >10 lines | 15-line code block → Tag has `collapsed` attribute |
| 6 | Omits `collapsed` for ≤10 lines | 5-line code block → no `collapsed` attribute |
| 7 | Stores raw code in `data-code` attribute | Code content accessible in `pre` tag's `data-code` |

#### 11.2 `heading.markdoc.ts`

**File:** `server/tests/schema/heading.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Renders accessible heading with anchor | `## Foo` → `<h2 id="foo"><a ...>` |
| 2 | Generates correct `id` slug from text | `## Hello World` → `id="hello-world"` |
| 3 | Preserves heading level | `### Bar` → `h3` tag |
| 4 | Anchor `href` matches `id` | `href="#hello-world"` matches `id="hello-world"` |

#### 11.3 `callout.markdoc.ts`

**File:** `server/tests/schema/callout.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Renders `card-callout` element | Tag name is `card-callout` |
| 2 | Accepts valid class values | `.info`, `.tip`, `.danger`, `.note`, `.caution` all pass validation |
| 3 | Defaults class to `info` | No class attribute → `class="info"` |
| 4 | Renders children inside callout | Paragraph child → present in rendered output |

#### 11.4 `hero.markdoc.ts`

**File:** `server/tests/schema/hero.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Renders `section-hero` element | Tag name is `section-hero` |
| 2 | Extracts H1 as title child | `# Title` inside hero → h1 Tag in children |
| 3 | Creates `.hero-layout` div with `.lead` and `.toc-placeholder` | Children include div with class `hero-layout` |
| 4 | Handles hero with only title (no lead) | No paragraph → still has `toc-placeholder` |

#### 11.5 `demo.markdoc.ts`

**File:** `server/tests/schema/demo.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Renders `module-demo` element | Tag name is `module-demo` |
| 2 | Separates preview HTML from markdown by `---` | Content before HR → `preview-html` attribute |
| 3 | Handles fence-based demo (no separator) | Code fence → `preview-html` from fence content |
| 4 | Transforms markdown after separator | Paragraph after HR → rendered in children |

#### 11.6 `listnav.markdoc.ts`

**File:** `server/tests/schema/listnav.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Renders `module-listnav` wrapper | Tag name is `module-listnav` |
| 2 | Creates `form-listbox` with `role="listbox"` | Children contain `form-listbox` with `role="listbox"` div |
| 3 | Groups items by nested list structure | Nested list → `role="group"` divs with group labels |
| 4 | First option has `aria-selected="true"` | First button has `aria-selected="true"` |
| 5 | Non-first options have `tabindex="-1"` | Second button has `tabindex="-1"` |
| 6 | Extracts `href` from links as `value` | `[Foo](/bar.html)` → `value="/bar.html"` |
| 7 | Validation rejects empty list | No list children → critical validation error |
| 8 | Includes `module-lazyload` content area | Children contain `module-lazyload` Tag |

#### 11.7 `carousel.markdoc.ts`

**File:** `server/tests/schema/carousel.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Renders `module-carousel` element | Tag name is `module-carousel` |
| 2 | Creates prev/next navigation buttons | Children include buttons with class `prev` and `next` |
| 3 | Wraps slides in tablist structure | Contains `role="tablist"` |

#### 11.8 `section.markdoc.ts`

**File:** `server/tests/schema/section.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Renders `<section>` element | Tag name is `section` |
| 2 | Passes through `class` attribute | `{% section .breakout %}` → `class="breakout"` |
| 3 | Renders children inside section | Paragraph child → present in output |

---

### 12. `file-signals.ts` — Signal Pipeline & Frontmatter

**File:** `server/tests/file-signals.test.ts`
**Category:** Unit + Integration

The `extractFrontmatter` function is not exported, but its behavior is observable through the `docsMarkdown.processed` memo. For unit testing, either export it (recommended: add a named export guarded by a comment) or test it indirectly.

#### 12.1 Frontmatter extraction (unit — export `extractFrontmatter` for testing)

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Extracts title | `---\ntitle: 'Hello'\n---\nBody` | `metadata.title === "Hello"` |
| 2 | Extracts all known fields | Frontmatter with `title`, `emoji`, `description`, `layout`, `section` | All fields populated |
| 3 | Parses `order` as integer | `order: 3` | `metadata.order === 3` |
| 4 | Parses `draft` as boolean | `draft: true` | `metadata.draft === true` |
| 5 | Parses `tags` as comma-separated array | `tags: a, b, c` | `metadata.tags === ["a", "b", "c"]` |
| 6 | Returns empty metadata for no frontmatter | `Just body content` | `metadata === {}`, content unchanged |
| 7 | Strips quotes from values | `title: "Quoted"` and `title: 'Quoted'` | `metadata.title === "Quoted"` |
| 8 | Returns content without frontmatter block | `---\ntitle: X\n---\nBody` | `content === "Body"` |
| 9 | Handles malformed frontmatter gracefully | `---\ninvalid\n---\nBody` | No crash, returns best-effort metadata |

#### 12.2 Processing pipeline (integration — requires temp files + signal init)

| # | Test | Expected |
|---|------|----------|
| 1 | `docsMarkdown.processed` extracts metadata from all source files | Map size matches number of `.md` files |
| 2 | `docsMarkdown.pageInfos` builds correct `PageInfo` array | Each entry has `url`, `title`, `emoji`, `description` |
| 3 | `pageInfos` URL replaces `.md` with `.html` | File `index.md` → `url: "index.html"` |
| 4 | `pageInfos` detects section from subdirectory | File at `api/foo.md` → `section: "api"` |
| 5 | `pageInfos` sets empty section for root files | File `index.md` → `section: ""` |

#### 12.3 Full Markdoc processing (`fullyProcessed` — integration)

| # | Test | Expected |
|---|------|----------|
| 1 | Processes valid Markdown to HTML | Simple `# Hello` → contains `<h1` or `<h2` in `htmlContent` |
| 2 | API section strips content above first H1 | Content with preamble + `# Title` → preamble removed |
| 3 | Calculates correct `depth` for nested files | `api/functions/foo.md` → `depth: 2` |
| 4 | Calculates correct `basePath` | `depth: 2` → `basePath: "../../"` |
| 5 | Sets `basePath` to `"./"` for root files | `depth: 0` → `basePath: "./"` |
| 6 | Does not add API section wrapper post-processing | API file output is not wrapped in `<section class="api-content">` |
| 7 | Extracts title from frontmatter | `title: "Guide"` → `processedFile.title === "Guide"` |
| 8 | Extracts title from API heading when no frontmatter title | `# Function: foo()` → `title === "foo"` |

---

### 13. `file-watcher.ts` — File Watcher

**File:** `server/tests/file-watcher.test.ts`
**Category:** Integration

Tests require temporary directories with real files. Set `PLAYWRIGHT=1` to disable `fs.watch` and test only the scanning behavior.

| # | Test | Expected |
|---|------|----------|
| 1 | `watchFiles` scans initial files matching glob | Temp dir with 3 `.md` files → list has 3 items |
| 2 | `watchFiles` respects `exclude` glob | Dir with `mocks/a.html` and `b.html`, exclude `**/mocks/**` → only `b.html` |
| 3 | `watchFiles` returns empty list for empty directory | Empty temp dir → list has 0 items |
| 4 | `watchFiles` returns empty list for non-existent directory | Path that doesn't exist → list has 0 items, no crash |
| 5 | Each `FileInfo` has correct `path`, `filename`, `content`, `hash` | Check all fields for a known file |
| 6 | `watchFiles` supports recursive glob `**/*.ts` | Nested `sub/dir/file.ts` → found in list |
| 7 | `watchFiles` skips watching under Playwright | Set `PLAYWRIGHT=1` → no `fs.watch` call (verify via console log or spy) |

---

### 14. `serve.ts` — HTTP Server Routes

**File:** `server/tests/serve.test.ts`
**Category:** Server

Start an isolated server instance on a random port for each test suite. Pre-populate `docs/` with minimal fixture files. Set `NODE_ENV=production` to disable HMR injection by default; test HMR injection separately with `NODE_ENV=development`.

#### 14.1 Route responses

| # | Route | Method | Expected status | Expected content |
|---|-------|--------|----------------|------------------|
| 1 | `/api/status` | GET | 200 | Body is `"OK"` |
| 2 | `/` | GET | 200 | Contains `<!doctype html` or fixture content |
| 3 | `/:page` (existing) | GET `/getting-started` | 200 | Serves `docs/getting-started.html` content |
| 4 | `/:page` (missing) | GET `/nonexistent` | 404 | Body is `"Not Found"` |
| 5 | `/assets/:file` (existing) | GET `/assets/main.css` | 200 | Correct CSS content |
| 6 | `/assets/:file` (missing) | GET `/assets/nope.css` | 404 | `"Not Found"` |
| 7 | `/examples/:component` | GET `/examples/basic-counter.html` | 200 | HTML content |
| 8 | `/sources/:file` | GET `/sources/basic-counter.html` | 200 | HTML content |
| 9 | `/test/:component` | GET `/test/basic-counter` | 200 | Contains component HTML inlined in test layout |
| 10 | `/test/:component` (missing) | GET `/test/nonexistent` | 404 | `"Component not found"` |
| 11 | `/test/:component/mocks/:mock` | GET | 200 | Serves mock file |
| 12 | `/favicon.ico` | GET | 200 or 404 | Serves file if present |
| 13 | `/ws` (non-dev) | GET | 404 | `"Not available in production"` |
| 14 | Unknown route | GET `/a/b/c/d` | 404 | `"Not Found"` |

#### 14.2 Content negotiation

| # | Test | Expected |
|---|------|----------|
| 1 | `/:page` with `Accept: text/markdown` returns `.md` source | Content-Type `text/markdown`, body is raw Markdown |
| 2 | `/` with `Accept: text/markdown` returns `index.md` source | Content-Type `text/markdown` |
| 3 | `/:page` with `Accept: text/html` returns HTML | Normal HTML response |

#### 14.3 HMR injection (development mode)

| # | Test | Expected |
|---|------|----------|
| 1 | HTML responses contain HMR script in dev mode | Body includes `WebSocket` and `/ws` |
| 2 | HTML responses omit HMR script in production mode | No `WebSocket` or `__HMR__` in body |
| 3 | Non-HTML responses are not modified | CSS file has no `<script>` injected |

#### 14.4 Layout selection

| # | Test | Expected |
|---|------|----------|
| 1 | `/test/:component` uses `test` layout | Response uses test layout structure |
| 2 | `/api/functions/foo` would use `api` layout | `getLayoutForPath("/api/functions/foo")` → `"api"` |
| 3 | `/examples` would use `overview` layout | `getLayoutForPath("/examples")` → `"overview"` |
| 4 | `/getting-started` uses default `page` layout | `getLayoutForPath("/getting-started")` → `"page"` |

#### 14.5 WebSocket / HMR (development mode)

| # | Test | Expected |
|---|------|----------|
| 1 | WebSocket upgrade succeeds on `/ws` | Connection opens, receives `build-success` message |
| 2 | Ping message receives pong | Send `{"type":"ping"}` → receive `{"type":"pong"}` |
| 3 | `broadcastToHMRClients` delivers message to all clients | Connect 2 clients, broadcast → both receive |
| 4 | Disconnected client is removed from set | Close one client → `hmrClients.size` decrements |

---

### 15. `build.ts` — Build Orchestration

**File:** `server/tests/build.test.ts`
**Category:** Integration

These tests verify the orchestration logic, not individual effect correctness. Mock or stub the effects where possible.

| # | Test | Expected |
|---|------|----------|
| 1 | `build()` returns a cleanup function | Return value is a function |
| 2 | Cleanup function calls all effect cleanups | Spy on each effect → all called when cleanup invoked |
| 3 | `build({ watch: false })` completes without hanging | Resolves within timeout |
| 4 | `build()` sets working directory to project root | `process.cwd()` ends with project root after call |
| 5 | `setHMRBroadcast` stores broadcast function | After setting, HMR notifications are forwarded |
| 6 | `build({ watch: true })` sends `build-success` via HMR | Mock broadcast → receives `{ type: "build-success" }` |
| 7 | Build error in watch mode sends `build-error` via HMR | Simulate failure → broadcast receives `{ type: "build-error" }` |
| 8 | Build error in non-watch mode throws | `await expect(build()).rejects.toThrow()` |
| 9 | All 8 effects are registered | Count `createEffect` calls or verify cleanup calls |

---

### 16. Effects — `effects/*.ts`

**Category:** Integration

Effects are harder to unit test because they depend on reactive signals and external tools. Test strategy: **create minimal fixture files in a temp directory**, override config paths to point there, run the effect, and verify the output files.

For effects that shell out (`apiEffect` → `typedoc`, `cssEffect` → `lightningcss`, `jsEffect` → `bun build`), write **smoke tests** that verify the command succeeds with real (minimal) input files, or **mock `execSync`** and verify the command string.

#### 16.1 `effects/pages.ts` — Page Generation

**File:** `server/tests/effects/pages.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Generates HTML file for each processed markdown | N markdown files → N `.html` files in output dir |
| 2 | Applies correct layout from frontmatter `layout` field | `layout: "overview"` → uses `overview.html` template |
| 3 | Defaults to `page` layout when no layout specified | No `layout` in frontmatter → `page.html` template |
| 4 | Replaces `{{ content }}` with rendered HTML | Output contains processed Markdown content |
| 5 | Replaces `{{ title }}` with page title | Output contains frontmatter title |
| 6 | Replaces `{{ css-hash }}` and `{{ js-hash }}` | Output contains hash strings in asset URLs |
| 7 | Loads `{{ include 'menu.html' }}` directives | Menu include resolved in output |
| 8 | Unknown include files produce empty string | `{{ include 'nonexistent.html' }}` → removed silently |
| 9 | Unreplaced template variables become empty | `{{ unknown-var }}` → `""` |

#### 16.2 `effects/menu.ts` — Menu Generation

**File:** `server/tests/effects/menu.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Writes `menu.html` to includes directory | File exists at `MENU_FILE` path |
| 2 | Output contains `<section-menu>` root element | File content starts with `<section-menu>` |
| 3 | Only root pages appear (no section pages) | Page with `section: "api"` → not in menu |
| 4 | Pages are sorted by `PAGE_ORDER` | `"index"` appears before `"about"` |
| 5 | Skips menu generation when no root pages found | No pages → file not written |

#### 16.3 `effects/sitemap.ts` — Sitemap Generation

**File:** `server/tests/effects/sitemap.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Writes `sitemap.xml` to output directory | File exists at `SITEMAP_FILE` path |
| 2 | Output is valid XML with `<?xml` declaration | Starts with `<?xml version=` |
| 3 | Contains one `<url>` per page | N pages → N `<url>` elements |
| 4 | Home page has priority `1.0` | `index.html` entry → `<priority>1.0</priority>` |

#### 16.4 `effects/examples.ts` — Example Page Generation

**File:** `server/tests/effects/examples.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Generates HTML for each component with matching `.md` and `.html` | `basic-counter/basic-counter.md` + `.html` → `docs/examples/basic-counter.html` |
| 2 | Skips components without matching HTML file | `.md` exists but no `.html` → warning logged, no output |
| 3 | Skips markdown files that don't match directory name | `basic-counter/README.md` → skipped |
| 4 | Replaces `{{ content }}` marker with HTML fence block | Output contains highlighted HTML from component |
| 5 | Processes Markdoc tags in example markdown | `{% demo %}` in markdown → `module-demo` in output |

#### 16.5 `effects/sources.ts` — Source Fragment Generation

**File:** `server/tests/effects/sources.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Generates tab group HTML for each component | `basic-counter` → `docs/sources/basic-counter.html` |
| 2 | Includes HTML panel for every component | Output contains `role="tabpanel"` with HTML content |
| 3 | Includes CSS panel when `.css` file exists | Component with CSS → panel with label `"CSS"` |
| 4 | Includes TS panel when `.ts` file exists | Component with TS → panel with label `"TypeScript"` |
| 5 | Last panel is selected by default | Last `PanelType` in array has `selected: true` |
| 6 | Skips non-matching filenames | `basic-counter/other.html` → not processed |

#### 16.6 `effects/service-worker.ts` — Service Worker Generation

**File:** `server/tests/effects/service-worker.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | Writes `sw.js` to output directory | File exists at `docs/sw.js` |
| 2 | Output contains `CACHE_NAME` with hashes | Contains both CSS and JS hash substrings |
| 3 | Output contains `addEventListener('install'` | Install event listener present |
| 4 | Output contains `addEventListener('fetch'` | Fetch event listener present |

#### 16.7 `effects/css.ts` — CSS Bundling (smoke test)

**File:** `server/tests/effects/css.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | `execSync` is called with `lightningcss` command | Command string contains `lightningcss`, `--minify`, `--bundle` |
| 2 | Command targets `CSS_FILE` as input | Contains `examples/main.css` |
| 3 | Command outputs to `ASSETS_DIR` | Contains `docs/assets/main.css` |

#### 16.8 `effects/js.ts` — JS Bundling (smoke test)

**File:** `server/tests/effects/js.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | `execSync` is called with `bun build` command | Command contains `bun build` |
| 2 | Command targets `TS_FILE` as input | Contains `examples/main.ts` |
| 3 | Command includes `--minify` and `--sourcemap` | Both flags present |

#### 16.9 `effects/api.ts` — API Doc Generation (smoke test)

**File:** `server/tests/effects/api.test.ts`

| # | Test | Expected |
|---|------|----------|
| 1 | `execSync` is called with `typedoc` command | Command contains `typedoc` |
| 2 | Command uses `typedoc-plugin-markdown` | Contains `--plugin typedoc-plugin-markdown` |
| 3 | Command outputs to `API_DIR` | Contains `docs-src/api/` |

---

## Verification Processes

### Process 1: After any change to template functions

1. Run `bun test server/tests/templates/`
2. Verify all template output tests pass
3. Run `bun run build:docs` and spot-check one generated page in a browser

### Process 2: After any change to Markdoc schemas or helpers

1. Run `bun test server/tests/schema/ server/tests/markdoc-helpers.test.ts`
2. Run `bun run build:docs` and verify example pages render correctly
3. Check that validation errors appear for intentionally malformed Markdoc content

### Process 3: After any change to file signals or file watcher

1. Run `bun test server/tests/file-signals.test.ts server/tests/file-watcher.test.ts`
2. Run `bun run dev`, edit a `.md` file in `docs-src/pages/`, and confirm the browser reloads with updated content
3. Run `bun run build:docs` and verify output file count matches source file count

### Process 4: After any change to serve.ts or routes

1. Run `bun test server/tests/serve.test.ts`
2. Run `bun run dev` and manually verify:
   - Home page loads at `/`
   - A documentation page loads at `/<page>`
   - An example loads at `/examples/<component>`
   - A test page loads at `/test/<component>`
   - HMR reconnects after server restart
3. Run `bun run serve:examples && bunx playwright test examples` — Playwright tests must pass

### Process 5: After any change to build.ts or effects

1. Run `bun test server/tests/build.test.ts server/tests/effects/`
2. Run `bun run build:docs` — must complete without errors
3. Verify key output files exist:
   - `docs/index.html`
   - `docs/assets/main.css`
   - `docs/assets/main.js`
   - `docs/sitemap.xml`
   - `docs/sw.js`
   - `docs-src/includes/menu.html`
   - At least one file in `docs/examples/`
   - At least one file in `docs/sources/`
4. Run `bun run dev` and confirm HMR broadcasts `build-success` on startup

### Process 6: Full regression check (before release or major refactor)

1. Run `bun test server/tests/` — all tests pass
2. Run `bun run build:docs` — clean build succeeds
3. Run `bun run serve:docs` — server starts, pages render
4. Run `bun run serve:examples && bunx playwright test examples` — all Playwright tests pass
5. Run `bun run dev` — HMR works, file changes trigger rebuild + reload

---

## Implementation Priority

| Priority | Test file(s) | Rationale |
|---|---|---|
| 🔴 P0 | `io.test.ts`, `templates/utils.test.ts` | Pure functions, highest regression risk, easiest to write |
| 🔴 P0 | `markdoc-helpers.test.ts`, `schema/fence.test.ts`, `schema/heading.test.ts` | Core content pipeline — breakage here corrupts all pages |
| 🔴 P0 | `serve.test.ts` (routes only) | Route regressions break the entire dev experience |
| 🟡 P1 | `templates/menu.test.ts`, `templates/sitemap.test.ts`, `templates/fragments.test.ts` | Template output regressions are hard to spot visually |
| 🟡 P1 | `file-signals.test.ts` | Frontmatter + pipeline correctness |
| 🟡 P1 | `schema/callout.test.ts`, `schema/hero.test.ts`, `schema/demo.test.ts`, `schema/listnav.test.ts` | Schema regressions affect documentation content |
| 🟡 P1 | `effects/pages.test.ts`, `effects/menu.test.ts`, `effects/sitemap.test.ts` | Most critical effects |
| 🟢 P2 | `build.test.ts` | Orchestration logic — less likely to regress |
| 🟢 P2 | `file-watcher.test.ts` | Harder to test reliably, lower change frequency |
| 🟢 P2 | `templates/hmr.test.ts`, `templates/service-worker.test.ts`, `templates/performance-hints.test.ts` | Supporting templates |
| 🟢 P2 | `effects/examples.test.ts`, `effects/sources.test.ts`, `effects/service-worker.test.ts` | Remaining effects |
| 🟢 P2 | `effects/css.test.ts`, `effects/js.test.ts`, `effects/api.test.ts` | Smoke tests for shell-out effects |
| 🟢 P2 | `config.test.ts`, `schema/carousel.test.ts`, `schema/section.test.ts` | Low change frequency |

**Total:** ~160 individual test cases across 28 test files.
