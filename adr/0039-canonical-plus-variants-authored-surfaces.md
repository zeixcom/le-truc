# ADR 0039: Canonical-Plus-Variants — One Tag, Build-Selected Surface Spellings

## Status

✅ Accepted — owner ruling 2026-09-21 (LT-238), amending [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) sub-design 6 by reference; the one-source-per-tag ruling text stands there, unedited.

## Context

[ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) sub-design 6 ruled one component tag = one authored source, enforced by LTC048, because a tag with two corpus owners makes the generated artifact names, the tag-keyed registry, and the browser registration (`customElements.define` throws on the second registration) ambiguous. The wave-4 owner ruling (2026-09-18, LT-238) requires the opposite for the showcase corpus: each example carries **all three spellings side by side** — the hand-written `.ts` twin, the `.tsrx` compile, the `.tsx` compile — because (a) the same Playwright spec must pass against each, making the spec the runtime equivalence contract the way the parity suite is the build-time one, and (b) the three spellings side by side are the honest showcase of the surfaces' trade-offs — under the [v3 general-purpose-framework goal](../REQUIREMENTS.md#the-v3-goal-a-general-purpose-framework-not-repo-tooling), external-facing ([M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format)). Two measured facts decided the shape: the parity suite pins server render and CSS byte-identity but only *structural* client-module identity, so two live compiled components are behaviorally identical yet differ in bytes; and authored CSS is tag-scoped by convention (every stylesheet leads with the tag selector), so a renamed variant tag is unstyled by verbatim CSS.

## Decision

**Canonical + build-selected variants.** A corpus folder may carry a **variant set** — at most one authored source per surface sharing one base name in one directory: the hand-written `.ts` twin (never compiled by the corpus scan), one `.tsrx`, one `.tsx` — all declaring one canonical tag.

1. **The corpus compile compiles every compilable member** of a variant set — each must compile clean — asserts **CSS byte-identity** across the compiled members, and **writes only the selected surface's artifacts** under the canonical names (`<tag>.server.ts` / `<tag>.client.ts` / `<tag>.css`). Selection is **`.tsx` by default** — the ADR 0032 default surface, default by rule rather than by practice — overridden per tag by `variantSurface` / `variantOverrides` in `le-truc.config.json` ([ADR 0036](0036-corpus-configuration-surface.md)'s surface; the LT-273 config validation extends to the new keys). The registry stays one entry per tag; its `source` names the selected member. Cross-surface markup equivalence stays where it is proven today: the parity suite for its fixtures, and the spec matrix at runtime.
2. **The spec is the runtime equivalence contract**: the same Playwright spec runs unchanged against each spelling of a variant set — twin-served, `.tsrx`-compiled, `.tsx`-compiled — via a surface selection on the component test route (`/test/<tag>`); the runner exercises the variant-carrying examples' specs per surface.
3. **LTC048 narrows, does not retire**: a tag declared by two sources of the same surface, or by sources that are not a folder-local variant set, still fails the build naming both files — **channel: compiler, tier 1 Prevented** (statically decidable, no runtime half). Tech Writer owns the message copy per the ADR 0028 lifecycle.
4. **One `declare global` owner per set**: within a variant set exactly one member declares the `HTMLElementTagNameMap` entry — the `.ts` twin when present, else the `.tsrx`, else the `.tsx` — because separately declared Props types make duplicate entries a TS 2717 error under the examples typecheck. The tsc error is the check (**channel: TypeScript, tier 1 Prevented**); no compiler rule is added. The CEM keeps exactly one declaration per tag: the twins of compiled components join the CEM exclusion list while their components are compiled.

The docs showcase renders all three sources from the one folder beside one live demo of the selected surface. No derived tags exist anywhere in the corpus, registry, or CEM.

## Alternatives Considered

- **Suffixed variants (derived tags)** — one spelling owns the tag, the others compile to `basic-counter--tsx` and all three register on one page; the spec addresses each directly in one run. **Rejected:** verbatim tag-scoped CSS cannot style a derived tag, so the compiler would need a tag-selector-rewrite capability; the registry, tier census and CEM triple per showcased component, blurring the pinned census regression signal; the hand-written twin renames its `defineComponent` tag, though it is the CEM-analyzed artifact of record. Simultaneity was weighed at full weight (the framework goal makes the showcase external-facing) and still rejected: under the parity contract a live side-by-side of the two compiled surfaces demonstrates identity, not trade-offs — the trade-offs are authoring-time and live in the source text, which this decision displays directly.
- **Explicit per-tag surface selection (no default)** — an unselected variant set fails the build asking for a choice. **Rejected:** a config entry per showcased component and a new failure mode on every new variant folder; contradicts the "default by rule, not by practice" finding (COMPILER_REFLECTION §2).

## Consequences

**Good:** the corpus carries all three spellings without disturbing any pinned artifact semantics — one registry entry, one census row, one CEM declaration per tag; the twin stays byte-for-byte the artifact of record; the spec-equivalence contract takes its purest form (same spec, unchanged, against each build); CSS drift inside a variant set becomes a build failure; migrations stop deleting work — "retain the twin as a variant".

**Bad:** every variant set compiles twice per build (bounded: compiling the corpus takes seconds); the served client is one surface, so cross-surface render equivalence is pinned only at the parity fixtures (build time) and at the spec matrix (runtime), not corpus-wide in the build; a variant set's docs demo shows one live spelling per build — simultaneity is only reachable via per-surface builds, not one page; the tag-map declaration-ownership convention is one more thing a new variant set must get right, though a wrong owner is a loud tsc error, never a silent break.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking)
- Architecture: [Authoring Surfaces](../ARCHITECTURE.md#authoring-surfaces)
- Amends: [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) sub-design 6; extends the [ADR 0036](0036-corpus-configuration-surface.md) configuration surface
