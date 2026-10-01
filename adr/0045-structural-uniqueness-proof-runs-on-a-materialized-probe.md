# ADR 0045: The Structural-Uniqueness Proof Runs on a Materialized Probe

## Status

✅ Accepted (owner, 2026-10-01)

## Context

The compiler's selector engine proves `first()` selectors, branch exclusivity, and cardinality structurally before the generated client ever issues a `querySelector` — the premise is that counting matches in the proof is counting matches in the DOM. That proof walked the template IR by hand in five near-identical cascades, each re-encoding the branch-exclusivity arithmetic (max over mutually exclusive arms, sum over coexisting ones) and each carrying its own hand selector matcher gated on a hand grammar that had to track the synthesizer exactly or fail silently. The drift was real: the review's §2.4 findings and LT-221's probe both grew in this soil. LT-230 centralized the traversal through `walk.ts` and recorded the `@pending` policy, but the matching and the counting arithmetic stayed hand-rolled.

The spike (LT-245, 2026-10-01) tested the alternative shape — materialize the template the compiler renders and query it with a real CSS engine — and reproduced every answer the hand cascades give, over the whole corpus and synthetic pins, with a differential harness whose negative check discriminates loudly.

## Decision

1. **The proof runs on a materialized probe.** Serialize the template IR structurally to HTML — static attributes only, all branches materialized — parse with parse5, and answer matching, counting, and match-existence with [css-select](https://github.com/fb55/css-select). Branch exclusivity rides each element as an attribute naming the path of mutually exclusive arms it sits in; a count aggregates the matched elements' paths, taking the max over the arms of a group and summing everything else (coexisting arms included). An attribute travels with its element through every HTML tree-correction move; wrapper elements do not — the parser foster-parents an unknown element out of table context and drops it inside `<select>`, so wrapped arms lose their group. Compose sites have no DOM existence until render and never enter the parse: their source-keyed counts run the same path aggregation over the serializer's own record. One aggregation replaces the cascades; matching leaves hand code entirely.
2. **The probe is browser-faithful.** It counts what a browser's parse of the emitted markup builds, not what the authored nesting says. Where the two disagree, the browser wins — the runtime query runs against the browser's tree. Invalid authoring (a `<div>` inside a `<p>`) can diverge arbitrarily; valid authoring diverges only by an element the parser implies (the `<tbody>` around a `<table>`'s bare rows), which the DOM really holds and which exists exactly when its nearest authored ancestor does. Both are pinned.
3. **css-select joins the compiler's dependencies** ([M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight) justification: its closure is boolbase, css-what, domhandler, domutils, nth-check — all pure JS, no realm or DOM globals, so the runtime-neutrality gate `check:portability` applies unchanged; parse5 is already a dependency).
4. **Policy stays in-house.** Candidate order (role → bare tag → discriminator), authored-selector-first emission, clean-before-excluded `:not()` emission, and the element-chain searches are compiler policy, not traversal — they remain in `server/compiler/analysis/selectors.ts`. The swap replaces the engine (matching, counting, existence), not the policy.
5. **Selector parse validation moves onto css-what** (which arrives with css-select): `selector-syntax.ts`'s hand rules and `parseSimpleSelector`'s subset become a css-what parse plus a small post-check. Widening what `first()` can *verify* (descendant combinators, `:not()`, attribute operators — queried against the same probe) is a separate, authoring-visible change and is deliberately not part of this decision.

## Alternatives Considered

- **Route the cascades through `walk.ts` and keep hand matching** (LT-230's NO-GO branch): traversal consolidation without touching the risky half. Rejected — the hand grammar and its load-bearing pairing with the synthesizer are where the drift lived; the spike showed the engine dissolves into ~25 lines once matching is delegated.
- **Mirror the authored IR exactly** with htmlparser2 (no HTML5 content-model correction): would keep probe counts equal to authored nesting. Rejected — adds a second parser, and faithfulness to authored nesting is faithfulness to a tree the browser will never build.
- **postcss-selector-parser** for the parse-validation half: parses selector text but offers no tree to query, so it cannot serve the engine. Rejected — css-what arrives with css-select and covers the same shapes.

## Consequences

- **Good:** one exclusivity policy in one walk; matching semantics delegated to a maintained CSS engine, ending the matcher-vs-synthesizer pairing risk; `matchesUnder` becomes a single existence query; authored-selector verification can widen later without new machinery; the differential harness (corpus + synthetic + negative pins) permanently guards the engine.
- **Good:** no wrapper elements sit between an element and its parent or siblings in the probe tree, so child and sibling combinators match there as they do in the browser — a later widening of what `first()` can verify inherits that for free.
- **Bad:** one more (pure-JS, server-side) dependency. css-select ignores `<template>` element contents in HTML mode, so an authored `<template>` is refused as a compile error on both surfaces (the compiler owns template extraction anyway); the probe serializes such a template's content in place only so the analysis that still runs after the error can keep collecting diagnostics. Browser-faithful counting is a real, if latent, divergence from authored nesting for invalid authoring — by design, per Decision 2.

## Related

- Requirements: [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight), [M25](../REQUIREMENTS.md#m25-tooling-continuity)
- Architecture: `server/compiler/analysis/selectors.ts` (the engine's home; policy code stays there), `server/compiler/walk.ts` (traversal policy, LT-230)
- Supersedes: —
- Superseded by: —
