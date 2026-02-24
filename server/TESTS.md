# Test Plan — Server & Build System

Test strategy, conventions, and verification processes for `server/`. Tests use **Bun's built-in test runner** (`bun:test`).

Reference: [SERVER.md](./SERVER.md) for architecture details.

---

## Scope

### What to test

- **All pure functions** — deterministic input/output, no side effects (highest value, lowest cost)
- **Template generators** — tagged template literals that produce HTML, XML, CSS, JS strings
- **Markdoc helpers and schemas** — AST transformation, validation, rendering
- **IO utilities** — file hashing, path manipulation, safe writes
- **HTTP server routes** — status codes, content types, HMR injection, layout selection
- **Build effects** — file generation, cleanup, error handling

### What NOT to test (out of scope)

- Third-party library internals (`@markdoc/markdoc`, `shiki`, `@zeix/cause-effect`)
- Playwright browser tests (live in `examples/`)
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
├── helpers/
│   └── test-utils.ts              # Shared test utilities
├── config.test.ts                 # Configuration constants
├── file-watcher.test.ts           # File watcher
├── io.test.ts                     # IO utilities
├── markdoc-constants.test.ts      # Markdoc constants
├── markdoc-helpers.test.ts        # Markdoc helper utilities
├── serve.test.ts                  # HTTP server routes
├── schema/
│   ├── callout.test.ts
│   ├── carousel.test.ts
│   ├── demo.test.ts
│   ├── fence.test.ts
│   ├── heading.test.ts
│   ├── hero.test.ts
│   ├── listnav.test.ts
│   ├── section.test.ts
│   ├── sources.test.ts
│   └── table.test.ts
├── templates/
│   ├── fragments.test.ts
│   ├── hmr.test.ts
│   ├── menu.test.ts
│   ├── sitemap.test.ts
│   └── utils.test.ts
└── effects/
    ├── api-pages.test.ts
    ├── api.test.ts
    ├── examples.test.ts
    ├── mocks.test.ts
    └── sources.test.ts
```

### Running tests

```json
"test:server":             "bun test server/tests",
"test:server:unit":        "bun test server/tests --bail",
"test:server:integration": "bun test server/tests --timeout 10000",
"test:server:watch":       "bun test server/tests --watch"
```

### Shared test helpers

`server/tests/helpers/test-utils.ts` provides:

- `createTempDir()` — creates an isolated temp directory; returns `{ path, cleanup }`
- `createTempFile(dir, filename, content)` — writes a file and returns its path
- `createTempStructure(baseDir, structure)` — creates a nested directory/file tree from a plain object
- `mockMarkdown(options)` — generates markdown with optional frontmatter
- `mockHtml(options)` — generates a minimal HTML document
- `mockFileInfo(overrides)` — factory for `FileInfo`-shaped objects
- `mockRequestContext(options)` — factory for server request context
- `normalizeWhitespace(str)` / `normalizeHtml(html)` — normalize output for comparison
- `assertContains` / `assertNotContains` / `assertMatches` / `assertValidHtml` — assertion wrappers
- `wait(ms)` / `retryUntil(fn, options)` — timing helpers for async/integration tests

---

## Verification Processes

### Process 1: After any change to template functions

1. Run `bun test server/tests/templates/`
2. Verify all template output tests pass
3. Run `bun run build:docs` and spot-check one generated page in a browser

### Process 2: After any change to Markdoc schemas or helpers

1. Run `bun test server/tests/schema/ server/tests/markdoc-helpers.test.ts server/tests/markdoc-constants.test.ts`
2. Run `bun run build:docs` and verify example pages render correctly
3. Check that validation errors appear for intentionally malformed Markdoc content

### Process 3: After any change to file-watcher.ts

1. Run `bun test server/tests/file-watcher.test.ts`
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

1. Run `bun test server/tests/effects/`
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