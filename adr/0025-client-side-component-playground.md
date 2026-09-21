# ADR 0025: Client-Side Component Playground

## Status

🔄 Proposed (2026-09-21)

## Context

The compiler (ADR [0024](0024-adopt-tsrx-as-isomorphic-component-format.md)) is a set of pure string→string stages with all corpus context injected as parameters — loadable in a browser bundle, its purity CI-pinned (§7 of `server/compiler/LE_TRUC_COMPILER.md` has the embedding audit). Since ADR [0032](0032-adopt-tsx-as-the-authored-component-surface.md) it is a **dual front end**: `.tsx` is the primary authored surface, `.tsrx` remains supported, one machinery layer underneath both. Meanwhile the docs site shows compiled examples statically — a visitor cannot edit a component source and watch the isomorphic model actually work. A live playground (a REPL for component sources) would make the [§1 core insight](../REQUIREMENTS.md#the-core-insight) demonstrable, put the diagnostic catalogue ([ADR 0028](0028-tiered-error-surfacing.md)) in front of real users, and turn the dual-front-end claim — one machinery layer, two surfaces, byte-identical output (the parity contract, ADR 0032 s6) — from something asserted in tests into something a visitor can feel, including the ergonomics boundary that motivated the dual ruling: statement-context control flow reads better in `.tsrx`, new authoring defaults to `.tsx`.

## Decision

Build the playground as a Le Truc component on the docs site that **compiles entirely in the visitor's browser** on both front ends: authored sources default to `.tsx`, with `.tsrx` selectable — the playground demonstrates ADR 0032's dual front end, not a single grammar. The docs server ships static assets; it never compiles. Sub-designs:

1. **All-client pipeline, zero roundtrips — both front ends in the bundle.** The same entry points the build effect dispatches — `compileComponent` (`server/compiler/frontend/tsrx`) and `compileComponentTsx` (`server/compiler/frontend/tsx`), thin shells over the shared `compileFromIR` — run in a browser bundle of `server/compiler/`, the surface chosen per source extension exactly as `compileCorpus` dispatches. Corpus context (`registry`, `childImports`, `composeRegistry`) is supplied in memory from a pre-compiled example set; render args come from an args panel; editor state (surface, source, args) is shareable via the URL hash. The UI's output panes are exactly the pipeline's artifacts: server HTML (from executing `render<Name>(args)` against `runtime.ts`, browser-pure), the verbatim CSS, and the transpiled client JS.

2. **Preview = sandboxed iframe; the document is an assembled artifact.** Per compile, the three outputs are assembled into one document string — rendered HTML, inlined `<style>`, inlined client `<script>` — and bound to the iframe's `srcdoc`. A fresh document per compile gives a fresh custom-element registry (custom elements cannot be unregistered; no `tagOverride` emitter change needed) and isolates visitor-authored code. Interactive state inside the preview resets on each recompile — accepted: components re-seed from the DOM, which is precisely the model being demonstrated (ADR 0003).

3. **One Task signal produces the document.** `deriveCell(async () => doc)` wraps the compile/assemble worker roundtrip; `watch` writes `srcdoc` on `ok` only. `stale` (recompile in flight) and `err` (non-compilable source) intentionally keep the last good frame — cause-effect's retained-value semantics ([M12](../REQUIREMENTS.md#m12-async-task-signals)) give "last good preview" for free. Compiler diagnostics travel a separate fast lane to the editor regardless: they are synchronous products of the compile, not of the Task.

4. **Tiered cadences; heavy tiers live in workers.** Fast lane (~150 ms debounce): parse → lower → analyze → emit + front-end diagnostics, in a compile worker. Preview lane (~300–500 ms): transpile + document assembly, same worker, feeding the Task. Type lane (stage 2, same commitment): a `tsc` language-service worker over a virtual FS (generated client+server modules, `@zeix/le-truc` types, `globals.d.ts`) — the `check:corpus` gate ported in-browser, and the one place the surfaces legitimately diverge: a `.tsx` source is checked **directly** on the authored file (`jsx: preserve`, ADR 0032 s3), its diagnostics carrying authored-file positions with no remapping, while a `.tsrx` source keeps the emit-then-check route with diagnostics remapped through the `spans.ts` helpers. Nothing heavy runs on the main thread; the editor and signals never block.

5. **Self-contained inline JS for v1.** The per-compile client module is transpiled *and linked* against a virtual `'@zeix/le-truc'` module — the closed, parity-tested import vocabulary guarantees that module's export set — producing one import-free `<script type="module">` inlined into the document. No import maps, no blob/data-URL origin questions inside the sandbox; an import-map variant stays open as an optimization spike if link cost matters at cadence.

6. **Structural gate: landed for the `.tsrx` front end; the bundle grows the second.** The Node-API removal this decision rode on is done and CI-pinned: `scripts/build-tsrx-browser.ts` bundles `server/compiler/frontend/tsrx/index.ts` with `node:*` externals left unshimmed, and `server/tests/compiler/browser-bundle.test.ts` asserts no surviving `node:` import plus Node/browser byte-identity on a fixture — the seed of the playground's compile worker. The playground bundle adds `server/compiler/frontend/tsx/index.ts` over the same machinery, its purity assertion riding the same gate; the `typescript` package's Node-side paths are expected to force a parser-scoped entry point rather than the package root — bundle-shape work belonging to this ADR's implementation.

## Alternatives Considered

- **Server-side compile endpoint (roundtrip per compile)**: rejected — per-keystroke latency and load, no offline capability, and the compiler is pure anyway; the server stays a static asset host (ADR 0024 sub-design 7's boundary unchanged).
- **Same-document preview via tag rebasing or scoped element registries**: rejected — `customElements` has no unregister, a tag rewrite leaks into selectors/query messages/registry entries, scoped registries are Chromium-only, and neither isolates visitor code.
- **Shadow-DOM-only preview (no iframe)**: rejected for the same registry/sandbox reasons; the iframe sits *inside* the playground component's shadow DOM, so the component stays Le Truc-native where it can be.
- **Volar/LSP projection as the type-flow vehicle (LT-014)**: rejected — the emit-then-check span-table model ports to a worker as-is and serves the playground sooner. ADR 0032 then retired LT-014 as moot for `.tsx` (editors work through plain tsserver); what survives of this entry is the `.tsrx`-only remap, which the type lane carries.
- **A `.tsx`-only playground (mirroring the published package's posture, [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md))**: rejected for the docs site — both surfaces are first-class in-repo and the parity suite holds them equivalent, so shipping both is near-free; the playground is where the ergonomics tradeoff behind the dual ruling can actually be felt. TSX-only governs distribution, not demonstration.
- **Incremental (AST-reuse) compilation**: deferred — whole-file recompile at debounce cadence is milliseconds at single-file playground scale; the explicit `AnalysisContext` from the analyze split is the substrate if measurement ever demands more.
- **Preserving preview state across recompiles (DOM patching instead of document swap)**: rejected — it would misrepresent DOM-is-truth seeding, the very behavior the playground exists to show.

## Consequences

**Good:**

- The isomorphic story becomes interactive: edit source → watch artifacts change → watch the enhanced preview, with zero hydration payload ([§1](../REQUIREMENTS.md#the-core-insight)).
- The playground dogfoods the library end to end — the Task-driven preview with last-good-frame retention is a live demonstration of [M12](../REQUIREMENTS.md#m12-async-task-signals) semantics.
- The dual front end becomes visitor-visible: one bundle, two surfaces, byte-identical artifacts — the parity contract (ADR 0032 s6) demonstrated rather than asserted.
- The diagnostic catalogue (ADR 0028) gets a showcase surface; `.tsrx` sources keep the span-table remap user-facing in the type lane.
- Zero per-keystroke server load; the page works offline once loaded; states are shareable via URL hash.
- The compiler's browser purity stays a CI-enforced invariant, now expected across both front ends.

**Bad / accepted tradeoffs:**

- Toolchain payload on the docs page — the TypeScript compiler (shared by the `.tsx` front end and the type lane), esbuild-wasm, and `@tsrx/core` for `.tsrx` sources — several MB, lazy-loaded on first playground interaction.
- Preview interactive state resets on every recompile (srcdoc swap) — accepted, mitigated by debounce; the reset-and-reseed *is* the product's behavior.
- Two consumption contexts (Node build effect, browser bundle) must stay identical — held by the single package plus goldens, and enforced by the browser-bundle smoke test.
- Sanctioned-subset gates surface raw to visitors (LTC005 "outside the sanctioned subset" etc.) — the playground doubles as the gate catalogue and needs deliberate UX copy.
- The sandbox/module-hosting question (import map with blob/data URLs vs. self-contained inlining) is only settled for v1; reopens as a spike if transpile+link cost at preview cadence proves too slow.

## Related

- Requirements: [§1 core insight](../REQUIREMENTS.md#the-core-insight), [M12 async task signals](../REQUIREMENTS.md#m12-async-task-signals), [M13 accurate types](../REQUIREMENTS.md#m13-typescript-types-exported-and-accurate), [S2 actionable error messages](../REQUIREMENTS.md#s2-required-element-error-messages-are-actionable)
- Architecture: [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors), `server/compiler/LE_TRUC_COMPILER.md`
- Related ADRs: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the compiler), [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) (the dual front end this playground demonstrates — `.tsx` default, `.tsrx` retained), [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (DOM-is-truth — what the preview demonstrates), [ADR 0010](0010-trusted-types-support-via-sanitize-hook.md) (sanitizer hook precedent for `html={}`), [ADR 0017](0017-keyed-template-clone-reconciliation-for-lists.md) / [ADR 0018](0018-implicit-effect-collection-via-ambient-context.md) (previewed constructs)
- Tasks: the compiler regrouping and the browser-purity gate have landed (`scripts/build-tsrx-browser.ts`, `server/tests/compiler/browser-bundle.test.ts`); playground implementation tasks to be filed on acceptance of this ADR.
