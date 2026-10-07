# ADR 0048: The Children Contract — Parent-Owned Content, Child-Declared Roles

## Status

✅ Accepted (owner, design session 2026-10-06). Amends [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s10. Revised 2026-10-07 (owner ruling): ownership carries no style meaning, and styles follow the platform ([ADR 0033](0033-scope-component-styles-by-custom-element-name.md)).

## Context

A parent passes content into a composed child as `children`, and the child inserts it at `{children}` ([ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s10). Nothing yet says who owns that content.

Today, every mechanism treats the content as the child's:

- The structural verifier excludes everything under a composed child, so a parent's `first()` into its own children fails.
- The child can address any element in the content.

A real shadow root decides this the other way: slotted content belongs to the tree that authored it. `<select>` and `<option>` show the platform's model for a child acting on its children: a fixed set of roles, nothing else.

## Decision

**Content a parent passes as `children` belongs to the parent. The child acts on it only through roles it declares in its `children` type, and it may constrain the content model.**

1. **The parent owns the content.** The content is part of the parent's template: its structure, text, bindings and `first()` references. At a compiled compose site with children, the server writes the region marker `data-children="<parent-tag>"` on the child's element that encloses `{children}`. The marked element remains the child's; its descendants form the **Children Region**. A child that inserts `{children}` directly in its root gets the marker on its host, so the region is everything the host renders. Own elements the child renders beside the insertion are allowed and count as part of the region.

   The marker names the content's owner, not the nearest compose site. When a child passes its own `children` straight through, the original owner's tag rides along. An instance the page renders has no compiled owner and gets no marker. The structural verifier counts the region as the parent's markup and excludes only the child's own template. The runtime query that excludes composed children re-includes the region.

2. **The child acts only through declared roles.** The `children` type declares roles: `Children<{ tab: 'button', panel: 'section' }>`. A role key is a class; its value is the expected tag, which types the child's `first('.tab')`. When a child's `first()`/`all()` into the region targets no declared role, that is a reach-in.
   - Channel: compiler.
   - Tier: Prevented ([ADR 0028](0028-tiered-error-surfacing.md) s1).
   - It is decidable from the child's selectors and its declared roles.

3. **One writer per property.** A parent binding a property that the child's contract writes on a role element is a conflict.
   - Channel: compiler.
   - Tier: Prevented.
   - It is decidable from the compose registry.

4. **The content model.** A second type argument constrains the content: `Children<Roles, 'non-interactive'>` (`Children<{}, 'non-interactive'>` declares no roles). The compiler checks the compose site's literal children, and composed children whose templates contain interactive content, transitively through the registry.
   - Interactive means: `a[href]`, `button`, `input`, `select`, `textarea`, `label`, `details`, `iframe`, `[tabindex]`, and media with `controls`.
   - Channel: compiler.
   - Tier: Prevented.
   - TypeScript cannot carry the check: JSX element types are opaque. Page-authored HTML stays unchecked.

5. **Styles follow the platform, not ownership.** The marker is a query and verification fact. It adds nothing to the emitted CSS. Both sheets apply to the content as they would on the platform ([ADR 0033](0033-scope-component-styles-by-custom-element-name.md)): the parent's scoped rules reach it as descendants, and so do the child's, unless an authored limit stops them. A child that wants its rules to stop at the content limits its scope at its own insertion element, such as `to (.body > *)`. A limit on the marker would apply only under a compiled parent, so a page-rendered instance would style differently. The compiler's downward-leak warning treats passed content as the parent's own markup, not as a leak.

## Alternatives Considered

- **A `display: contents` wrapper as the region root**: CSS identical to the marker, and it breaks content models. The HTML parser foster-parents the wrapper out of `<tbody>`, which drops the marker. `ul > li`, `select > option` and `dl > dt` stop matching through it.
- **Ownership with style meaning** (the first form of point 5): the child's scope stopped at the region, the parent's re-entered it, and a re-include patched self-nesting. The emitted CSS diverged from the authored sheet. A child styled its children differently under a page and under a compiled parent, and root insertion needed an exception. In the lowered form it cost up to about 13.5 kB raw per component.
- **Owner marks on every element** (Vue's `data-v-*`, Svelte's hash class, Angular's `_ngcontent-*`): ownership by construction, with trivial selectors. Rejected in ADR 0033 s11: a mark in every served element, and it erodes the compose-site discriminators. The region marker is the same idea, made sparse: one mark per region.
- **The child keeps full reach into its children**: the `<select>` model needs a declared surface. Unrestricted reach makes every parent's markup part of the child's implicit contract.

## Consequences

**Good:**

- A parent addresses and binds the content it writes. The child acts on it only through a typed, checked surface.
- Content-model violations are build errors at the compose site, not accessibility bugs found in review.
- Ownership adds no CSS. A component styles its content the same way under a page and under a compiled parent.

**Bad / accepted tradeoffs:**

- The served HTML gains about 30 bytes per compose site with children.
- Unlike `::slotted()`, a child's rules reach the content's descendants. A child that wants less writes a limit.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking)
- Amends: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s10 (children ownership)
- Styles: [ADR 0033](0033-scope-component-styles-by-custom-element-name.md)
- Related: [ADR 0028](0028-tiered-error-surfacing.md) (tiers), [ADR 0045](0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md) (the structural proof), [ADR 0046](0046-reactive-list-items-as-mount-scopes.md) (Mount Scopes)
- Evidence: `spike/children-scope/FINDING.md` (the browser matrix and byte measurements behind the rejected style form)
