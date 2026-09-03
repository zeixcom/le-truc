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
├── html-shaping.test.ts           # Final HTML shaping (link handling, demo previews)
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
    ├── blog-pages.test.ts
    ├── examples.test.ts
    ├── llms-full-manifest.test.ts
    ├── llms-manifest.test.ts
    ├── md-mirror.test.ts
    ├── mocks.test.ts
    └── sources.test.ts
```

31 files, 671 tests as of this writing (`bun test server/tests`) — treat as approximate; the file tree above is the source of truth.

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
- `wait(ms)` / `retryUntil(fn, options)` — timing helpers for async/integration tests.
  `retryUntil` takes `timeout`, `interval`, `condition`, and optional `backoff` /
  `maxInterval` (fixed-interval by default; `backoff: 2` doubles the wait after each failed
  attempt up to `maxInterval` — gentler on a loaded machine, same convergence on a healthy
  one). The `timeout` is wall-clock: when a test sits behind real-world timing, raise bun's
  per-test timeout (`test(name, fn, timeout)`) to match — the lower of the two caps is the
  one that actually fires.
- `settle(promise)` — awaits a promise that may reject and resolves to
  `PromiseSettledResult<T>` (`{ status, value/reason }`). Use it instead of
  `await expect(p).rejects.toThrow(...)`: bun-types types every matcher as returning `void`,
  so the awaited-matcher form draws TS 80007 while still leaving the assertion unawaited.
  Assert on the outcome — see the JSDoc for the canonical shape.

`server/tests/helpers/generated-tsrx.ts` provides:

- `createGeneratedDir(label)` — a per-run output directory for tests that EMIT or EXECUTE
  generated TSRX modules; returns `{ path, relativePath, emit, importModule, cleanup }`

**Never write into `server/generated/tsrx/` from a test** (LT-140). That directory belongs to
the build pipeline, and sharing it makes the suite intermittently red in two ways: a
concurrent `build-tsrx` / `check:tsrx` / dev server overwrites a module between a test's write
and its import, and two test files choosing the same tag overwrite each other, since
`bun test` shares one process and one module registry. Take a `createGeneratedDir()` instead
and `afterAll(() => generated.cleanup())`. Tests that drive the real corpus runner pass the
directory through: `compileTsrxCorpus(files, generated.path)`.

The directory is deliberately a sibling of the real one rather than an OS temp dir — emitted
modules address `../../tsrx/runtime` and `../../../examples/…` relatively, so only the same
depth under the repo root keeps those specifiers resolving.

Sharing the directory also HIDES bugs, not just causes flakes: two tests were passing on
artifacts a previous `build-tsrx` had left behind, asserting over modules they never compiled.
If a test needs a module it does not itself emit, emit it explicitly.

### Server Simulation driver tests

`server/tests/tsrx/sim-realm.test.ts` covers `server/tsrx/sim/` (ADR 0027, LT-151). It defines
its components **inline through the realm's recording registry** rather than importing generated
modules, so it needs neither `server/generated/` nor a `createGeneratedDir()`. Two things to know
when extending it:

- The realm patches `globalThis` (`document`, `HTMLElement`, `customElements`, `fetch`, …) for
  its lifetime, and `bun test` shares one process. Always take a realm through the file's
  `withRealm()` helper so `afterEach` disposes it; a leaked realm leaves DOM globals installed
  for every later test file.
- Cross-runtime equivalence is **not** a unit test — it needs a second and third process. Run
  `bun run check:sim`, which reports which runtimes it found and exits non-zero if their
  serialized HTML differs.

`server/tests/tsrx/sim-driver.test.ts` runs the WHOLE corpus through the driver (LT-154) and
owns, next to the build-report baseline below, the 22 fixture snapshots and two corpus
invariants (LT-164). Three things to know about the snapshots and invariants:

- The simulated snapshots are **per-substrate bytes**. Inline-style serialization is
  substrate-specific (happy-dom terminates inline custom-property declarations with `;` where
  jsdom omits it — LT-152), so a substrate swap re-baselines every snapshot in the file at
  once and is NOT a behavior change. A single tag moving with no substrate change is one —
  treat it as a behavior change or a driver regression.
- The **double-connect fixed-point gate** (ADR 0027 sub-design 8) rides every fixture: the
  fixture feeds its own output back through a second `realm.render()` — what a browser does
  when it parses the served HTML and connects again — and requires byte-identical
  serialization. A component whose second pass differs fails the build against that
  component.
- The realm's `render()` memoizes on `(component, markup)` (LT-166): a repeated
  render of identical input returns the first pass's bytes without a second
  connect, so only the first occurrence reports diagnostics. Tests that need a
  fresh connect — a diagnostic per render, per-render connect effects — must
  render distinct markup (or a fresh realm), not the same input twice.
- The **two-order hermeticity test** (sub-design 10) renders the corpus in two orders on two
  realms and requires identical per-tag output. Order 2 needs its own module tree, because
  one module cache per process makes a second realm's import of order 1's client modules
  record no definitions — so the test copies the compiled tree to a second
  `createGeneratedDir()` instead of recompiling: fresh resolved specifiers, identical code,
  so a diff can only be order, never rebuild variance.

### The two regression baselines (LT-153 decision 2, LT-163)

Since the simulation driver took over renderability from the compiler, the wave-4 regression
signal is **two numbers**, not one:

1. **The compile baseline** — `bun run check:tsrx` counts the standing corpus warnings in
   its summary line (`Compile-warning baseline: N unique…`) — read that count, never a
   tail-read of the ⚠️ lines (LT-168). The gate-wave target is the counted **6 unique**
   (LT-145 and LT-146 remove form-listbox and form-tokenbox); the six `basic-pluralize`
   warnings are **correct refusals** — the fold cannot follow the authored `pluralCategory`
   const, its opaque `getLocale` helper, or the `hasAttribute` sensor — and they retire with
   TSRX034 at stage 3 (LT-165). Zero compile warnings is the stage-3 state. This is the
   channel for what is statically decidable.
2. **The build-report baseline** — `server/tests/tsrx/sim-driver.test.ts` runs the corpus
   through the simulation driver and requires **zero unclassified diagnostics**. The driver
   raises a diagnostic per condition (a jsdom `jsdomError`, an unhandled rejection, a
   contained connect throw, an attempted network call, a non-quiescent drain); the report
   layer in `server/tsrx/sim/report.ts` formats each as a build warning attributed to the
   component (tier 2, Contained — the build completes and the component keeps its
   server-rendered markup). A migration that renders wrong shows up here as a new entry, and
   the test fails naming it.

A diagnostic the build cannot fix is **classified, never silenced**: add a narrow
`{ kind, component, message, reason }` entry to `CLASSIFIED_DIAGNOSTICS` in `report.ts`, and
the report keeps listing every occurrence with its reason. Never widen an existing pattern to
admit a new diagnostic — that is how a real regression gets allowed through. When an entry
stops matching anything (the condition was fixed), retire the classification; the baseline
test says so. Tech Writer owns the report copy — see the `tech-writer` skill's
`workflows/error-message-lifecycle.md` (the five conditions are tier 2: wording says the
component *keeps* its server-rendered markup, never that the page broke).

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
3. Run `bun run serve:examples && node node_modules/.bin/playwright test examples` — Playwright tests must pass

### Process 5: After any change to build.ts or effects

1. Run `bun test server/tests/effects/`
2. Run `bun run build:docs` — must complete without errors
3. Verify key output files exist:
   - `docs/index.html`
   - `docs/assets/main.css`
   - `docs/assets/main.js`
   - `docs/sitemap.xml`
   - `docs/sw.js`
   - At least one file in `docs/examples/`
   - At least one file in `docs/sources/`
4. Run `bun run dev` and confirm HMR broadcasts `build-success` on startup

### Process 6: Full regression check (before release or major refactor)

1. Run `bun test server/tests/` — all tests pass
2. Run `bun run build:docs` — clean build succeeds
3. Run `bun run serve:docs` — server starts, pages render
4. Run `bun run serve:examples && node node_modules/.bin/playwright test examples` — all Playwright tests pass
5. Run `bun run dev` — HMR works, file changes trigger rebuild + reload
