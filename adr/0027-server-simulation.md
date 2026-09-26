# ADR 0027: Server Simulation — Render Initial HTML by Executing the Client Module

## Status

✅ Accepted — amended by [ADR 0029](0029-tiered-server-evaluation.md) (when simulation runs) and [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) (its boundary).

## Context

The split compiler decided renderability syntactically: an evaluability rule checked a thunk's free names, and a fold spliced server-known values into markup. That grammar has a ceiling — some idioms (bare `host` arguments to setup-const helpers, value-passing reshapes, non-prop config args) have no route into the fold set, and the remedy would make static config reactive, colliding with IDL reflection. The fact that dissolves the dilemma: the generated client already runs at connect against the real upgraded element — Le Truc enhances parsed HTML, it does not client-render — and Cause & Effect is environment-agnostic: the server can run the same client module against a model of that environment. jsdom covers every load-bearing behavior a spike required; hand-rolling a smaller DOM is maintaining a less complete solved problem.

## Decision

**Server Simulation**: the server renders initial HTML by executing the generated client module against jsdom, letting Cause & Effect evaluate the graph once; the emitted HTML is that graph's initial state. The client stays ground truth, correcting on connect — DOM-is-truth ([ADR 0003](0003-attributes-drive-state-at-connect-time-only.md)) and the flash trade unchanged. Simulation is the **Simulated**-tier mechanism, not the universal one: this ADR says what simulation *is*; [ADR 0029](0029-tiered-server-evaluation.md) says when it runs. [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) changes the boundary (DOM-free seam, SSG scope), not the mechanism.

1. **One evaluation mechanism** — for the components it runs for ([ADR 0029](0029-tiered-server-evaluation.md)): the driver parses the initial markup into the simulated document, registers the generated client against jsdom `customElements`, lets the upgrade run, serializes. Splice machinery retires where it runs; template lowering stays (the client builds no markup).

2. **The substrate is jsdom — no hand-rolled DOM.** One shared document per build; components defined children-before-parents so upgrade order is guaranteed. `whenDefined` resolves; IDL reflection is spec-faithful for free. Driver duties: stub absent constructors (`ResizeObserver`, `matchMedia`, `IntersectionObserver`, `requestAnimationFrame`); contain per component (a throw degrades to plain output, never blocks the build); close IO — network globals become a no-op that reports and never settles, so a fetching component routes `@pending`. `attachInternals()` flows through jsdom's skeletal surface, degradation scoped to form-associated components ([ADR 0026](0026-aria-reflection-via-elementinternals-and-bindaria.md)). **Standing substrate criterion:** the client module runs inside the substrate, so a consumer's `sanitize` hook runs there — any candidate must strip the hostile payload under DOMPurify first; **speed is not a qualifying argument** (`scripts/substrate-evaluation.ts` is the harness). No pluggability until a candidate passes ([ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s6).

3. **Bindings write the simulated document.** No recording layer: `watch()` installs normally, the `bind*` helpers write the jsdom DOM directly, the driver serializes after the connect pass — no diffing, no VDOM. The simulation document *is* the intermediate representation.

4. **Simulated connect.** The driver honors the library's child-await (`customElements.whenDefined`), so a parent's connect-time reads of child state never error — the browser's dependency-resolution semantics.

5. **Helper contract.** `host`: the simulated element; `first`/`all`: real `querySelector(All)` on the owned subtree; `expose`: as authored, reading attributes seeded from server args through the component's parsers; `pass`: existing lowering; `on`: no-op; contexts: no-op (the consumer holds its fallback); `internals`: deferred.

6. **Impure-ambient expressions are Unresolvable — omitted, not folded.** An expression reading the wall clock, the RNG or a runtime-default locale has no server answer: a build-time `Date.now()` is not an approximation the client corrects but a stale value cached into served HTML for the page's life. The simulation models the rendered fragment and nothing beyond — layout reads return silent zeros; the fixture-pinned corpus catches such drift.

7. **Staged rollout.** Stage 1: driver + substrate for `host` reads and reactive attributes, with sub-design 8's gate from the start. Stage 2: ref resolution and composition against the simulated tree. Stage 3: full driver-based rendering — a render module is still emitted for every tier ([ADR 0029](0029-tiered-server-evaluation.md)); only the Folded tier evaluates setup in the Value Harness.

8. **Connect must be a fixed point, and the driver proves it.** Served HTML is post-connect, and the browser runs connect again over it — enhancement must be idempotent over what enhancement produced. **Rule:** the driver connects twice and requires byte-identical output; a diverging second pass is a build error attributed to the component.

9. **Hermetic quiescence.** A synchronous window is wrong for composition — dependency resolution defers effect activation by a microtask. **Rule:** the window performs no driver IO and advances no timer; it drains the realm's microtask queue to a bounded quiescence, then serializes (exhausting the bound is a `non-quiescent` warning, not a hang). The arm that ships is a compiler decision: ship the resolved arm only when its value is harvestable from the component's own markup (seeding the client task from it); otherwise `@pending` — a resolved arm contradicted by an unseeded task regresses to the loading arm. The closed realm keeps IO from settling a task inside the window; a resolution phase *before* simulation may await build-time data.

10. **Renders stay a function of their args.** A generated client registers its element as an import side effect — once per process — so the driver loads each component once and renders it many times against that shared registry, disposal at end-of-process; renders stay pure per `(component, args)`: corpus order does not matter, repeat renders are byte-stable.

## Alternatives Considered

- **A hand-rolled DOM shim**: re-implements upgrade ordering, duplicates the reflection spec fact, buys refusal-as-diagnostic by maintaining a less complete solved problem.
- **happy-dom / linkedom**: linkedom lacks custom elements — disqualified. happy-dom **fails DOMPurify open**; the speed gap is not worth two sanitizers.
- **Widen the splice grammar**: every idiom needs its own proof rule, perpetuating the two-module drift simulation eliminates.
- **Make connect-time config reactive** to enter the fold set: reactivity is machinery, not semantics, for config; name collisions with IDL reflection.
- **Transplant server args into client scope**: invents a channel for values that already have a client home on the element's attributes.
- **A real browser as substrate**: maximal fidelity, orders of magnitude slower per build; revisit if the stub posture stops being containable.
- **Retain the determinism gate as a compile error beside simulation**: a static refusal beside an executing mechanism is the divergence hazard; its judgment survives as omission (s6), not refusal.

## Consequences

**Good:**

- The authored thunk is the executed truth — no reshape, no per-idiom grammar; upgrade machinery and reflection are jsdom's; the driver shrinks to import, register, instantiate, serialize.
- Cross-component initial state: a composing parent's connect-time reads see its children's defined reactive state.
- Element references execute against the rendered markup — ref drift is build-caught; the silent-empty-render class dissolves.
- jsdom is build-time only — the browser-only boundary holds; one sanitizer becomes possible (the `sanitize` hook policy untouched).

**Bad / accepted tradeoffs:**

- Build cost grows with every simulated occurrence (~1.1 ms each) — the cost [ADR 0029](0029-tiered-server-evaluation.md)'s tiering exists to contain.
- The server executes arbitrary authored code inside a full DOM; the stub posture is product surface. jsdom's failure modes are silent by default (layout zeros, absent APIs) — the fixture-pinned corpus is load-bearing.
- The quiescence window is weaker than a synchronous one — accepted in exchange for composition rendering at all.
- Simulation runs a code path no shipping browser runs; internals-only state (`:state()`, form members) renders nothing in served HTML — ARIA falls back to attributes ([ADR 0026](0026-aria-reflection-via-elementinternals-and-bindaria.md)).
- The diagnostics loss is structural: contained warnings restore refusal-as-diagnostic; legacy server-evaluation diagnostics re-ground in the tier classifier ([ADR 0029](0029-tiered-server-evaluation.md)).

## Related

- Requirements [§1](../REQUIREMENTS.md#the-core-insight), M5, M6, M8, [§5](../REQUIREMENTS.md#5-technical-constraints), [§7](../REQUIREMENTS.md#7-out-of-scope) — build tooling; `@zeix/le-truc` still never renders
- Architecture: [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors), [Server Evaluation Tiers](../ARCHITECTURE.md#server-evaluation-tiers)
- Related: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (connect-time seeding), [ADR 0010](0010-trusted-types-support-via-sanitize-hook.md) (the sanitize hook), [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (library boundary), [ADR 0026](0026-aria-reflection-via-elementinternals-and-bindaria.md) (`internals`), [ADR 0029](0029-tiered-server-evaluation.md) (when simulation runs), [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) (packaging and bounds)
