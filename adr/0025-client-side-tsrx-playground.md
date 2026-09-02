# ADR 0025: Client-Side TSRX Playground

## Status

🔄 Proposed (2026-08-25)

## Context

The inlined compiler (ADR 0024) is a set of pure string→string stages with all corpus context injected as parameters; a browser bundle needs only the removal of two `node:path` imports (`server/tsrx/LE_TRUC_COMPILER.md` §6–7 has the audit). Meanwhile the docs site shows compiled examples statically — a visitor cannot edit a `.tsrx` source and watch the isomorphic model actually work. A live playground would make the [§1 core insight](../REQUIREMENTS.md#the-core-insight) (server HTML + thin reactive enhancement, no hydration payload) demonstrable, put the TSRX diagnostic surface in front of real users, and de-risk LT-014 by making the LT-011 span-table remap user-facing before any editor tooling exists.

## Decision

Build the playground as a Le Truc component on the docs site that **compiles entirely in the visitor's browser**. The docs server ships static assets; it never compiles. Sub-designs:

1. **All-client pipeline, zero roundtrips.** The same `compileComponent` API the build effect uses runs in a browser bundle of `server/tsrx/`. Corpus context (`registry`, `childImports`, `composeRegistry`) is supplied in memory from a pre-compiled example set; render args come from an args panel; editor state is shareable via the URL hash. The UI's output panes are exactly the pipeline's artifacts: server HTML (from executing `render<Name>(args)` against `runtime.ts`, both browser-pure), the verbatim CSS, and the transpiled client JS.
2. **Preview = sandboxed iframe; the document is an assembled artifact.** Per compile, the three outputs are assembled into one document string — rendered HTML, inlined `<style>`, inlined client `<script>` — and bound to the iframe's `srcdoc`. A fresh document per compile gives a fresh custom-element registry (custom elements cannot be unregistered; no `tagOverride` emitter change needed) and isolates visitor-authored code. Interactive state inside the preview resets on each recompile — accepted: components re-seed from the DOM, which is precisely the model being demonstrated (ADR 0003).
3. **One Task signal produces the document.** `deriveCell(async () => doc)` wraps the compile/assemble worker roundtrip; `watch` writes `srcdoc` on `ok` only. `stale` (recompile in flight) and `err` (non-compilable source) intentionally keep the last good frame — cause-effect's retained-value semantics ([M12](../REQUIREMENTS.md#m12-async-task-signals)) give "last good preview" for free. TSRX diagnostics travel a separate fast lane to the editor regardless: they are synchronous products of the compile, not of the Task.
4. **Tiered cadences; heavy tiers live in workers.** Fast lane (~150 ms debounce): parse → lower → analyze → emit + TSRX diagnostics, in a compile worker. Preview lane (~300–500 ms): transpile + document assembly, same worker, feeding the Task. Type lane (stage 2, same commitment): a `tsc` language-service worker over a virtual FS (generated client+server modules, `@zeix/le-truc` types, `globals.d.ts`), diagnostics remapped through the existing `spans.ts` helpers — `check:tsrx` ported in-browser. Nothing heavy runs on the main thread; the editor and signals never block.
5. **Self-contained inline JS for v1.** The per-compile client module is transpiled *and linked* against a virtual `'@zeix/le-truc'` module — the closed, parity-tested import vocabulary guarantees that module's export set — producing one import-free `<script type="module">` inlined into the document. No import maps, no blob/data-URL origin questions inside the sandbox; an import-map variant stays open as an optimization spike if link cost matters at cadence.
6. **Structural gate is minimal and already planned.** Only the `node:path` removal blocks a browser build; it rides the compiler regrouping (LT-039–LT-045, `LE_TRUC_COMPILER.md` §7), whose remainder (`ir.ts`, `core.ts`, the analyze split) is enabling quality, not a prerequisite. A browser-bundle smoke test (LT-045) CI-pins the purity invariant permanently.

## Alternatives Considered

- **Server-side compile endpoint (roundtrip per compile)**: rejected — per-keystroke latency and load, no offline capability, and the compiler is pure anyway; the server stays a static asset host (ADR 0024 sub-design 7's boundary unchanged).
- **Same-document preview via tag rebasing or scoped element registries**: rejected — `customElements` has no unregister, a tag rewrite leaks into selectors/query messages/registry entries, scoped registries are Chromium-only, and neither isolates visitor code.
- **Shadow-DOM-only preview (no iframe)**: rejected for the same registry/sandbox reasons; the iframe sits *inside* the playground component's shadow DOM, so the component stays Le Truc-native where it can be.
- **Volar/LSP projection as the type-flow vehicle (LT-014)**: rejected — the emit-then-check span-table model ports to a worker as-is and serves the playground sooner; LT-014 remains a separate editor-integration concern that this playground de-risks.
- **Incremental (AST-reuse) compilation**: deferred — whole-file recompile at debounce cadence is milliseconds at single-file playground scale; the explicit `AnalysisContext` from the analyze split (LT-022) is the substrate if measurement ever demands more.
- **Preserving preview state across recompiles (DOM patching instead of document swap)**: rejected — it would misrepresent DOM-is-truth seeding, the very behavior the playground exists to show.

## Consequences

**Good:**

- The isomorphic story becomes interactive: edit source → watch artifacts change → watch the enhanced preview, with zero hydration payload ([§1](../REQUIREMENTS.md#the-core-insight)).
- The playground dogfoods the library end to end — the Task-driven preview with last-good-frame retention is a live demonstration of [M12](../REQUIREMENTS.md#m12-async-task-signals) semantics.
- LT-014's span-table remap gets real users before any Volar investment; the diagnostic catalogue (TSRX001–014) gets a showcase surface.
- Zero per-keystroke server load; the page works offline once loaded; states are shareable via URL hash.
- The compiler's browser purity becomes a CI-enforced invariant (LT-045), protecting embeddability permanently.

**Bad / accepted tradeoffs:**

- Toolchain payload on the docs page (esbuild-wasm and/or the TypeScript worker, ~1–3 MB) — lazy-loaded on first playground interaction.
- Preview interactive state resets on every recompile (srcdoc swap) — accepted, mitigated by debounce; the reset-and-reseed *is* the product's behavior.
- Two consumption contexts (Node build effect, browser bundle) must stay identical — held by the single package plus goldens, and enforced by the LT-045 smoke test.
- Sanctioned-subset gates surface raw to visitors (TSRX005 "outside the sanctioned subset" etc.) — the playground doubles as the gate catalogue and needs deliberate UX copy.
- The sandbox/module-hosting question (import map with blob/data URLs vs. self-contained inlining) is only settled for v1; reopens as a spike if transpile+link cost at preview cadence proves too slow.

## Related

- Requirements: [§1 core insight](../REQUIREMENTS.md#the-core-insight), [M12 async task signals](../REQUIREMENTS.md#m12-async-task-signals), [M13 accurate types](../REQUIREMENTS.md#m13-typescript-types-exported-and-accurate), [S2 actionable error messages](../REQUIREMENTS.md#s2-required-element-error-messages-are-actionable)
- Architecture: [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors), `server/tsrx/LE_TRUC_COMPILER.md`
- Related ADRs: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the compiler), [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (DOM-is-truth — what the preview demonstrates), [ADR 0010](0010-trusted-types-support-via-sanitize-hook.md) (sanitizer hook precedent for `html={}`), [ADR 0017](0017-keyed-template-clone-reconciliation-for-lists.md) / [ADR 0018](0018-implicit-effect-collection-via-ambient-context.md) (previewed constructs)
- Tasks: compiler regrouping LT-039–LT-045 (+ LT-022 analyze split) in `TODO.md`; playground implementation tasks to be filed on acceptance of this ADR.
