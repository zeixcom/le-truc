# ADR 0022: `debug()` Extension for Visual and Console Instrumentation

## Status

✅ Accepted

## Context

[REQUIREMENTS.md S3](../REQUIREMENTS.md#s3-development-mode-with-enhanced-diagnostics) commits to enhanced `DEV_MODE` diagnostics, specifically effect execution visibility. [N1](../REQUIREMENTS.md#n1-debug-flag-per-component-instance) asks for that visibility scoped to a single component instance via a `debug` flag. [ADR 0019](0019-extension-based-dependency-injection-for-definecomponent.md) anticipated this when it generalized `defineComponent`'s third parameter into a `ComponentExtension[]` array.

Two facts shape the design:

- **`ComponentExtension` can't see individual effects.** Its hooks (`onConnect`, `onAttributeChanged`) run per component, not per `watch()`/`on()`/`pass()` call, so per-effect instrumentation needs another mechanism.
- **Every effect helper registers its `EffectDescriptor` through the `collect()` chokepoint** before activation — the one place that already sees every effect a component registers, regardless of kind.

## Decision

Ship `debug()` (`src/extensions/debug.ts`), a `ComponentExtension` of the same shape as `formAssociated()`/`observedAttributes()`, adding a reactive `debug: boolean` property (default `false`). It is **not exported and not opted into.** `defineComponent()` appends it to the merged extensions array unconditionally whenever `process.env.DEV_MODE === 'true'`, whatever the caller passed. Every component in a `DEV_MODE` build gets the property and the behavior below with no change to its source. That conditional append is the primary gate keeping `debug()` out of production bundles; every call site inside `debug()` is also `DEV_MODE`-gated, as a second guard. `debug=true` in a production build does nothing, because the extension providing the property was never merged in: `debug` narrows `DEV_MODE` per instance and does not replace it.

This is a deliberate, narrow exception to ADR 0019's "`component.ts` never imports a concrete feature module" invariant: `component.ts` statically imports `debug()` so it has something to append. That invariant made tree-shaking a structural guarantee; `debug()` gives it up on purpose, because "zero code changes in user-written components" is the actual requirement and an opt-in mechanism can't deliver it. Production safety rests instead on the `DEV_MODE === 'true'` constant-fold plus dead-code elimination that the codebase's other dev-only diagnostics already rely on.

Of the candidate strategies, two ship, chosen for being cheap, in-DOM and additive rather than having the library render its own UI:

**1. `console.debug` logging.** One entry per `on()`/`pass()`/`watch()` firing that also drives a visual mark, so log volume tracks visual activity, not all reactive activity. Minimal fields: kind, element (if attributable), value. No styling or grouping until plain output proves insufficient.

**2. DOM-level visual marking**, using mechanisms the library already has:

- **Host indicator.** While `debug` is on, the host carries `:state(debug)` (via `bindState()`) and a permanent thin outline, visible even when nothing fires. Any `on()`/`pass()`/`watch()` firing for that host pulses it. Because this lives at the `collect()` chokepoint it needs no element attribution, and it is the only signal for a `watch()` handler that can't be mapped to a DOM node.
- **Per-element markings.** `on()`, `pass()`, and any `watch()` whose handler comes from a `bind*` helper set a presence-only `data-le-truc-on`/`-pass`/`-watch` attribute on the target element, color-coded per kind by a small injected stylesheet, and pulse on firing; there is no resting indicator beyond the attribute.
- **Attribution is exact or absent.** `on()` and `pass()` know their target from their signature. For `watch()`, each `bind*` helper records, in `DEV_MODE`, the element its returned setter closes over, and `watch()` looks the handler up there. A hand-written `watch()` handler is never guessed at; it falls back to the host indicator, because a wrong highlight is worse than none.
- **Augmentation is always additive.** Instrumentation pushes a second, independent descriptor (for `on()`, a sibling listener on the same target and event) whenever `DEV_MODE && host.debug`. The author's own descriptor or listener is never wrapped, modified or replaced, so switching `debug` on cannot change an app's behavior: ordering, error propagation and `stopImmediatePropagation()` semantics stay intact.
- **Scheduling stays in a private keyspace.** Pulses are deduplicated per element, once per frame, through the existing `schedule()` — under a private opaque key, never the element itself. `schedule()` is last-write-wins per key and functional DOM writes (`dangerouslyBindInnerHTML`) key on the element, so sharing that key would let a debug pulse discard a real write or the reverse, breaking the additivity rule above. Any future diagnostic scheduling needs its own key for the same reason.

**Toggling `debug`** has two entry points: the browser inspector's properties panel (a plain reactive property, the reliable fallback) and, in `DEV_MODE`, a single document-level capture-phase listener that toggles `debug` on `metaKey`+click. `metaKey` is provisional: Cmd/Ctrl+click on a link natively opens a new tab, but custom element hosts are rarely links, so the collision surface is judged small. The listener targets the nearest ancestor that actually has a `debug` accessor (`'debug' in node`), not the nearest dashed tag name — structural-only custom elements used as layout wrappers have no `debug` property, and stopping at them made the gesture silently do nothing. The walk crosses shadow boundaries, so it reaches a host from content inside its shadow root.

## Alternatives Considered

- **An in-library state-list and dependency-graph overlay**: a code-split custom element rendering live state. Rejected: it is the only candidate that has the library render its own UI, in tension with the "no client-side rendering" principle, and a materially bigger feature (layout, cross-instance registry, isolation concerns) than a debug flag. Not planned.
- **A real signal dependency graph**: `@zeix/cause-effect` doesn't expose its internal graph, so this would need a Cause & Effect API addition or Le Truc re-deriving the graph from `collect()` registrations. Out of scope.
- **A browser DevTools extension** with a forward-compatible global hook (`window.__LE_TRUC_DEVTOOLS_HOOK__`). Rejected, not deferred: a second codebase and deliverable with multi-browser store packaging and maintenance, and no near-term consumer to justify the hook's compatibility burden.
- **Heuristic attribution for `watch()`** (e.g. parsing `Function.prototype.toString()` for identifiers). Rejected: a wrong highlight actively misleads, which is worse than the honest host-level signal.
- **Per-state-change flashing** of the host on every reactive property write. Tried and dropped: it fired together with the effect-level marks and added noise without new information.
- **A two-key chord (`Alt+Shift+click`)** to avoid `metaKey`/`ctrlKey` native conflicts (link navigation, macOS secondary-click emulation). Set aside for the simpler single modifier, since hosts are rarely links; revisitable.
- **An opt-in, exported extension** passed in the `extensions` array like `formAssociated()`, keeping ADR 0019's invariant intact. Rejected: it requires editing every component to instrument it and un-editing it afterward, which fails the goal of inspecting *any* component, including third-party ones, without touching its source.

## Consequences

**Good:**
- Zero cost in production: every path is `DEV_MODE`-gated and constant-folds away, and an accidental `debug=true` does nothing.
- No new binding primitive, effect-collection or extension mechanism: marking reuses `bindState`/attribute writes, the `collect()`/`schedule()` chokepoints and ADR 0019's `ComponentExtension` shape.
- Every reactive firing is visible at some granularity — per element where attribution is possible, per host always — so unattributed `watch()` handlers get a coarser signal, never a silent gap.
- Works on every component in a `DEV_MODE` build, including third-party ones.

**Bad / accepted tradeoffs:**
- `watch()` attribution is partial: a handler not produced by a `bind*` helper gets only the host pulse, and authors need to know that distinction to read what they see.
- The `metaKey` gesture has a known, judged-small collision with Cmd/Ctrl+click-opens-link, with no `preventDefault()` mitigation committed; the properties panel is the documented fallback.
- Every `bind*` helper and every `on()`/`pass()`/`watch()` gain small `DEV_MODE`-gated work on the component-setup hot path.
- No state-list or dependency-graph view of the kind other frameworks' devtools offer (see Alternatives).
- `component.ts` statically imports `src/extensions/debug.ts`, breaking ADR 0019's structural guarantee for this one case. Production safety depends on the bundler folding `DEV_MODE` and eliminating the dead import, rather than being unreachable by construction. Constant-folding is necessary but not sufficient: anything in `debug.ts` the bundler considers side-effectful survives even when unreachable, which `test/regression-bundle.test.ts` guards against.
- The debug stylesheet is injected at connect, not lazily at first pulse, so a `DEV_MODE` page always carries one `<style>` element. Lazy injection is wrong: the stylesheet also holds the resting `:state(debug)` outline, so enabling debug on a component that isn't firing would otherwise show nothing.
- `debug` is a reserved property name on every component in a `DEV_MODE` build. `expose({ debug: … })` throws in dev but not in production, where the extension isn't merged, so the same component can be valid in one build and fail in the other (surfaced in `docs-src/pages/extensions.md`).

## Related

- Requirements: [S3](../REQUIREMENTS.md#s3-development-mode-with-enhanced-diagnostics), [N1](../REQUIREMENTS.md#n1-debug-flag-per-component-instance), [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects), [M6](../REQUIREMENTS.md#m6-automatic-dependency-tracking)
- Amends: [ADR 0019](0019-extension-based-dependency-injection-for-definecomponent.md) (names this ADR as the anticipated debug-instrumentation consumer of the extension mechanism)
- Supersedes: None
