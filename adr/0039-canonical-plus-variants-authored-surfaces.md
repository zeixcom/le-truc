# ADR 0039: Canonical-Plus-Variants — One Tag, Build-Selected Surface Spellings

## Status

✅ Accepted — amends [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) sub-design 6's one-source-per-tag rule.

## Context

[ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) sub-design 6 ruled one component tag = one authored source, enforced by LTC048. A tag with two corpus owners makes the generated artifact names, the tag-keyed registry, and the browser registration ambiguous (`customElements.define` throws on the second registration).

An owner ruling requires the opposite for the showcase corpus: each example carries **all three spellings side by side** — the hand-written `.ts` twin, the `.tsrx` compile, the `.tsx` compile. Two reasons:

- The same Playwright spec must pass against each, making the spec the runtime equivalence contract the way the parity suite is the build-time one.
- The three spellings side by side are the honest showcase of the surfaces' tradeoffs. Under the [v3 general-purpose-framework goal](../REQUIREMENTS.md#the-v3-goal-a-general-purpose-framework-not-repo-tooling) that showcase is external-facing ([M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format)).

Most projects never declare one tag twice; a component library might. Wherever one does, the build must still determine the canonical variant.

Two measured facts decided the shape. The parity suite pins server render and CSS byte-identity but only *structural* client-module identity, so two live compiled components are behaviorally identical yet differ in bytes. And the hand-written twin's CSS is tag-led, so a renamed variant tag is unstyled.

## Decision

**Canonical + build-selected variants.** A corpus folder may carry a **variant set**: at most one authored source per surface sharing one base name in one directory — the hand-written `.ts` twin (never compiled by the corpus scan), one `.tsrx`, one `.tsx` — all declaring one canonical tag.

1. **The corpus compile compiles every compilable member** of a variant set, and each must compile clean. It asserts **CSS byte-identity** across the compiled members and **writes only the selected surface's artifacts** under the canonical names (`<tag>.server.ts` / `<tag>.client.ts` / `<tag>.css`). Selection is **`.tsx` by default** — the ADR 0032 default surface, default by rule rather than by practice. It is overridden per tag by `variantSurface` / `variantOverrides` in `le-truc.config.json` ([ADR 0036](0036-corpus-configuration-surface.md)'s surface; the config validation extends to the new keys). The registry stays one entry per tag; its `source` names the selected member. Cross-surface markup equivalence stays where it is proven today: the parity suite for its fixtures, and the spec matrix at runtime.
2. **The spec is the runtime equivalence contract.** The same Playwright spec runs unchanged against each spelling of a variant set — twin-served, `.tsrx`-compiled, `.tsx`-compiled — via a surface selection on the component test route (`/test/<tag>`). The runner exercises the variant-carrying examples' specs per surface.
3. **LTC048 narrows, does not retire.** A tag declared by two sources of the same surface, or by sources that are not a folder-local variant set, still fails the build naming both files — **channel: compiler, Prevented** (statically decidable, no runtime half). Tech Writer owns the message copy per the ADR 0028 lifecycle.
4. **Every member declares its own tag-map entry.** Each member of a variant set — the `.ts` twin, the `.tsrx`, the `.tsx` — carries its own `declare global` `HTMLElementTagNameMap` entry for the canonical tag (owner ruling). The entry is load-bearing in the generated program. `check:corpus` typechecks only the served member's modules, and a composing parent's `first('<tag>')`/`pass()` types through the child's entry (ADR 0023 sub-design 6). So the served member must carry it whichever surface `variantOverrides` selects. Where two members share a tsc program (the twin and the `.tsx` under `examples/tsconfig.json`), structurally identical entries merge and diverging Props types fail with TS 2717. That is a free Props-drift check across spellings (**channel: TypeScript, Prevented**); no compiler rule is added. The CEM keeps exactly one declaration per tag: the twins of compiled components join the CEM exclusion list while their components are compiled.

The docs showcase renders all three sources from the one folder beside one live demo of the selected surface. No derived tags exist anywhere in the corpus, registry, or CEM.

## Alternatives Considered

- **Suffixed variants (derived tags)**: one spelling owns the tag, the others compile to `basic-counter--tsx`, and all three register on one page; the spec addresses each directly in one run. The twin's tag-led CSS cannot style a derived tag (compiled sheets could, under ADR 0033's scoping). The registry, tier census and CEM triple per showcased component, blurring the pinned census regression signal. The hand-written twin renames its `defineComponent` tag, though it is the CEM-analyzed artifact of record. Simultaneity was weighed at full weight (the framework goal makes the showcase external-facing) and still rejected: under the parity contract a live side-by-side of the two compiled surfaces demonstrates identity, not tradeoffs. The tradeoffs are authoring-time and live in the source text, which this decision displays directly.
- **One tag-map owner per set** (the `.ts` twin, else the `.tsrx`, else the `.tsx`): it chooses the owner by surface, but the entry is needed in the served member's generated program. A `.tsrx`-owned `form-listbox` served as `.tsx` leaves its composing parent untyped (`check:corpus` exit 2), and a twin-owned tag breaks the same way once anything composes it. Its premise — that duplicates are a TS 2717 error — holds only for diverging Props types. Two other owners were weighed: the served member (ownership moves on every override flip, twin case still broken) and a compiler-emitted entry from the registry's `propsType` (fixes the generated program but leaves the authored `.tsx` program blind).
- **Explicit per-tag surface selection (no default)**: an unselected variant set fails the build asking for a choice. It costs a config entry per showcased component and a new failure mode on every new variant folder, and contradicts the default by rule rather than by practice (sub-design 1; COMPILER_REFLECTION §2).

## Consequences

**Good:**

- The corpus carries all three spellings without disturbing any pinned artifact semantics: one registry entry, one census row, one CEM declaration per tag.
- The twin stays byte-for-byte the artifact of record.
- The spec-equivalence contract takes its purest form: the same spec, unchanged, against each build.
- CSS drift inside a variant set becomes a build failure.
- Migrations stop deleting work — "retain the twin as a variant".

**Bad / accepted tradeoffs:**

- Every variant set compiles twice per build (bounded: compiling the corpus takes seconds).
- The served client is one surface, so cross-surface render equivalence is pinned only at the parity fixtures (build time) and at the spec matrix (runtime), not corpus-wide in the build.
- A variant set's docs demo shows one live spelling per build; simultaneity is only reachable via per-surface builds, not one page.
- Every member repeats the tag-map entry — boilerplate per spelling. A diverging copy is a loud tsc error where two members share a program, never a silent break.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking)
- Architecture: [Authoring Surfaces](../ARCHITECTURE.md#authoring-surfaces)
- Amends: [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) sub-design 6; extends the [ADR 0036](0036-corpus-configuration-surface.md) configuration surface
