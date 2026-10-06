# ADR 0048: The Children Contract — Parent-Owned Content, Child-Declared Roles

## Status

✅ Accepted (owner, design session 2026-10-06). Amends [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s10 and [ADR 0033](0033-scope-component-styles-by-custom-element-name.md) s7.

## Context

A parent passes content into a composed child as `children`, and the child inserts it at `{children}` ([ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s10). Nothing yet says who owns that content.

Today, every mechanism treats the content as the child's:

- The structural verifier excludes everything under a composed child, so a parent's `first()` into its own children fails.
- The parent's style scope stops at the child's host ([ADR 0033](0033-scope-component-styles-by-custom-element-name.md) s3), so the parent styles that content only from `:global`. That rule leaks into the child's internals.
- The child's rules reach the content, and the child can address any element in it.

A real shadow root decides this the other way: slotted content belongs to the tree that authored it. The outer sheet styles it, and the inner sheet reaches only the slotted boxes, through `::slotted()`, where it loses to the outer context. `<select>` and `<option>` show the platform's model for a child acting on its children: a fixed set of roles, nothing else.

## Decision

**Content a parent passes as `children` belongs to the parent. The child acts on it only through roles it declares in its `children` type, and it may constrain the content model.**

1. **The parent owns the content.** The content is part of the parent's template: its structure, text, bindings and `first()` references. At a compiled compose site with children, the server writes the region marker `data-children="<parent-tag>"` on the child's element that encloses `{children}`. The marked element remains the child's; its descendants form the **Children Region**.

   The marker names the content's owner, not the nearest compose site. When a child passes its own `children` straight through, the original owner's tag rides along. An instance the page renders has no compiled owner and gets no marker. Its rules keep styling page-authored children, as ADR 0033 s7 states. The structural verifier counts the region as the parent's markup and excludes only the child's own template. The runtime query's exclusion takes the same form as the lowered style guard (point 5).

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

5. **Styles follow ownership.** Three additions extend ADR 0033 s3/s4.
   - **Child side.** The foreign region `[data-children]:not([data-children="<own-tag>"])` joins every scope's boundary set. The child's rules stop at the insertion point.
   - **Owner side.** The parent's rules re-enter its own regions.
     - Native: a second `@scope ([data-children="<tag>"])` block, with the same limits. Its rules take the lowered lead, and the subject is anchored by `:where(:scope *)`, an explicit `:scope` that keeps ancestor compounds outside the region matchable. Rules whose subject is the host are left out.
     - Lowered: the guard gains a re-include clause, with no second copy.
   - **Roles.** A child rule whose subject is a declared role class styles that element's box. The compiler wraps the subject in `:where()`, so the parent's rules win any tie in both emissions, as the outer context beats `::slotted()`. A child selector that descends below a role element styles the parent's content. That is the boundary-descent error (ADR 0033 s6).

   Every addition sits inside `:where()`, so specificity is unchanged.

6. **Self-nesting gates too little, never too much.** In `A > B > A′`, the lowered guard term `A B > * *` matches through the outer A. A guard that does not re-include leaves A′ unstyled. The lowered guard therefore re-includes a nested instance of its own tag and everything below it: `:is(A B > *, A B > * *):not(A B A, A B A *)`. Including the nested host itself keeps its guarded `:host` rules (`:host::before`, `:host .x`). It is always emitted, so nesting the page or runtime code creates is covered too.

   The cost is over-matching. The outer instance's rules reach the nested instance's internals: the same sheet, differing only in outer-instance conditions such as `:host(<sel>)` or an ancestor compound. They also reach the nested instance's own boundaries. Native region rules over-match the same way, because CSS cannot select the nearest instance. Authors fix an over-match with a class. Nothing fixes an unstyled element.

## Alternatives Considered

- **A `display: contents` wrapper as the region root**: CSS identical to the marker, and it breaks content models. The HTML parser foster-parents the wrapper out of `<tbody>`, which drops the marker. `ul > li`, `select > option` and `dl > dt` stop matching through it.
- **Status quo plus `:global`**: ownership would carry no style meaning. The parent's rules would leak into the child's internals and every composed element inside the content, and the child's rules would keep reaching the parent's content.
- **Owner marks on every element** (Vue's `data-v-*`, Svelte's hash class, Angular's `_ngcontent-*`): ownership by construction, with trivial selectors. Rejected in ADR 0033 s11: a mark in every served element, and it erodes the compose-site discriminators. The region marker is the same idea, made sparse: one mark per region, paid for in generated selector length.
- **Drop the guard for a boundary that may contain the host tag**: simpler than the re-include. But it leaks the parent's rules into all of that boundary's internals on every instance, and it misses nesting the compiler cannot see.
- **The child keeps full reach into its children**: the `<select>` model needs a declared surface. Unrestricted reach makes every parent's markup part of the child's implicit contract.

## Consequences

**Good:**

- A parent addresses, binds and styles the content it writes, as in a shadow root. The child acts on it only through a typed, checked surface.
- Content-model violations are build errors at the compose site, not accessibility bugs found in review.
- No authored CSS changes. The scoped sheet keeps its meaning, and the compiler emits the ownership.

**Bad / accepted tradeoffs:**

- The served HTML gains about 30 bytes per compose site with children.
- Every component that inserts `{children}` pays for the foreign-region boundary.
  - Native emission: about 60 bytes.
  - Lowered emission: 1–2 kB raw, about 60 bytes gzipped.
- An owning component's native sheet carries its scoped rules twice.
- Self-nesting over-matches in both emissions. This is a documented difference from a real shadow root.
- A child styles its children differently depending on whether a compiled parent or the page rendered it.
- The selector algebra is unreadable as authored CSS. It is a compiler artifact, and it shrinks to plain `@scope` as targets cross native support.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking)
- Amends: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s10 (children ownership), [ADR 0033](0033-scope-component-styles-by-custom-element-name.md) s7 (the documented differences)
- Related: [ADR 0028](0028-tiered-error-surfacing.md) (tiers), [ADR 0045](0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md) (the structural proof), [ADR 0046](0046-reactive-list-items-as-mount-scopes.md) (Mount Scopes)
- Evidence: `spike/children-scope/FINDING.md` (the browser matrix and byte measurements)
