# ADR 0033: Compiled Component CSS Is Shadow-Root CSS — Scoped in Light DOM, Emitted per CSS Target

## Status

✅ Accepted — owner ruling; ships in 3.0. Checks over the parsed sheet live in [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md); style composition stays on the [ROADMAP](../ROADMAP.md).

## Context

Hand-written stylesheets lead every rule with the component's tag. That stops **outward** leakage, because the tag is unique, but not **downward** leakage: a parent's `my-element .label` also matches `.label` inside a composed child. Only unchecked `>`-chain discipline, tied to exact DOM depth, avoids it.

The compiler knows which custom elements each template renders: exactly the boundary downward containment needs. But redefining valid tag-led CSS would make one form behave differently compiled and hand-written. The authored form needs a meaning of its own, implemented without raising the browser baseline above the runtime's.

## Decision

**A compiled component's stylesheet is authored as shadow-root CSS: `:host` for the host element, bare selectors for its internals. The compiler gives it shadow-root scoping in light DOM. Rules stop at the custom elements the template renders. The emission uses native `@scope` where the CSS target supports it, and a flat-selector lowering where it does not.**

1. **The contract.** Compiled light-DOM output behaves like the same sheet in a shadow root, except for the differences sub-design 7 documents. Hand-written CSS for runtime-only components emits verbatim and keeps its 2.x meaning.

2. **The authored form** is the same for leaf and composing components, in light and shadow mode. `:host` rules style the host. Bare class and element selectors style the internals. A composed child's own tag stays stylable, but a `.input` rule cannot reach a composed child's `.input`.

3. **Native emission** (`@scope` target). The sheet wraps in `@scope (my-element) to (<boundary> > *)`. The boundary is every custom-element tag the template renders. The `> *` keeps the child's host in scope and excludes its contents. A leaf gets no `to`. `:host` emits as `:where(:scope)`, which has zero specificity, so page styles win, as they do over `:host` in a shadow root. `@keyframes`, `@font-face`, `@property` and `:global` rules hoist out unchanged.

4. **Lowered emission** (no `@scope`). The output is flat selectors. The scope root leads as `:where(my-element)`, and each boundary tag adds a zero-specificity guard. `:host` becomes `:where(my-element)`. The zero-specificity lead gives a lowered rule the specificity of its native form (`:where(my-element) .x` ≙ `.x` under `@scope`). `:where()` and complex `:not()` are within the runtime's baseline. Nesting always lowers, because the emission rewrites flat selectors.

5. **The CSS target is configurable and defaults to Baseline widely available.** The `cssTargets` key in `le-truc.config.json` ([ADR 0036](0036-corpus-configuration-surface.md)) maps browser names to minimum versions, as an object rather than query strings, so it is deterministic and needs no dependency. A browser left out imposes no constraint. The default is a fixed version set, pinned at 3.0 and moved only with a major version. `@scope` is not widely available at that set, so the default lowers until a deliberate bump crosses that line.

6. **Authored forms that have no meaning under the contract are errors.** The channel is the compiler and the tier is Prevented ([ADR 0028](0028-tiered-error-surfacing.md) s1): each form is statically decidable and never correct.
   - A rule led by the component's own tag: inside the scope it would silently stop styling the host. The fix-it names `:host`.
   - `:host` directly followed by a qualifier (`:host.x`, `:host:hover`): it matches nothing in a shadow root. The fix-it moves the qualifier into the arguments.
   - A selector that descends past a boundary tag (`child-tag .x`): its subject is the child's content, which the scope excludes. Siblings and the child's own tag stay legal.
   - `::slotted()` in light mode, and `:host-context()` in either mode (it is removed from the spec).
   - `:global` in any form other than 6a's.
   - A malformed sheet (sub-design 9).

   **6a. The escape hatch is TSRX's `:global`, restricted to whole rules.** Two top-level forms are admitted, `:global(<selector>)` around the whole selector and a `:global` block, and both emit verbatim outside the scope. They serve a page-level rule that ships with a component, such as a scroll lock on `body`; the rule applies wherever the component's CSS is bundled. Every other form is an error. A nested or prefixed use would reach into composed children's markup, a trailing use is a no-op, and a leading use has no shadow-root equivalent (theming uses custom properties, which cross every boundary).

7. **The documented differences from a real shadow root**, each pinned by a fixture:
   - **Inward reach.** Page CSS can still reach a component's internals. This is the permanent light-DOM limit; only a real shadow root prevents it.
   - **Page-authored children** are styled by the component's rules. That is intended where nothing is slotted.
   - **Children passed to a composed child** belong to the passing component ([ADR 0048](0048-the-children-contract-parent-owned-content-child-declared-roles.md)). A region marker re-includes them in the passing component's scope and stops the child's scope, so they style as in a real shadow root, except under self-nesting.
   - **Self-nesting over-matches** in both emissions (ADR 0048 s6). In `A > B > A′`, where A's template renders B, A's rules also reach A′'s internals and boundaries. CSS has no nearest-instance selector, and a guard that excluded them would leave A′ unstyled. The sheet is the same, so the results differ only where a rule depends on the outer instance (`:host(<sel>)`, an ancestor compound).
   - **A custom element inserted at runtime is no boundary**, in either form. The boundary set is fixed at compile time, so the component's rules reach that element's internals.

8. **Shadow DOM is the opt-in for inward isolation, and more than a wrapper change.** The stylesheet is identical in both modes. In shadow mode it emits verbatim into the shadow root's `<style>`, `::slotted()` becomes legal, and `:global` rules move to the document stylesheet. The runtime is already shadow-aware (`first()`/`all()` query `host.shadowRoot ?? host`). Shadow-mode authoring must design for these limits: page-authored content renders only through slots, the children-are-data harvest stops at the boundary, ID references (`<label for>`, `aria-*`) do not cross it, page styles do not reach the internals, and Declarative Shadow DOM is Baseline 2024. The authored spelling is `<template shadowrootmode="open">` as the root's first child. Composed content still inserts at `{children}` ([ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s10); named slots would need their own decision. The mode is unscheduled.

9. **The stylesheet is parsed, not dedented.** Emission needs the rules and selectors, so the sheet goes through a `lightningcss-wasm` parse, self-contained under every runtime the portability check runs ([ADR 0038](0038-runtime-neutral-build-path.md)); its pin moves in lockstep with the CLI's. A parse error is Prevented: a malformed sheet has no correct emission. A declaration outside the CSS grammar is Contained and ships as authored, because the parser's property dictionary lags the platform. The parse is read-only: emission rewrites selector text and never round-trips nodes through the parser's write path. [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md) builds on this parse.

10. **Hand-written twin CSS splits off.** A compiled surface serves the emitted CSS; the twin's hand-written `.css` stays the 2.x artifact, served only with the twin. Variant-set CSS identity compares the compiled members' authored sheets.

11. **Upstream's hash-class scoping is not adopted.** It is a client-transform mechanism with no server-render counterpart. It also puts hash classes into every served byte, and it erodes the `class`/`id` discriminators at compose sites.

## Alternatives Considered

- **Auto-wrap tag-led sheets**: one authored form with two behaviors, compiled and hand-written, and nothing in the source says so.
- **Authors write `@scope` themselves**: every parent restates a boundary the compiler already knows.
- **An SCSS-like abstraction language**: no LSP or highlighting support.
- **Verbatim emission**: keeps the downward-leakage footgun.
- **Native `@scope` only**: excludes projects with older targets.
- **No escape hatch**: a component's page-level rule would live apart from it.
- **Shadow DOM as the default**: forces slots onto every composition and gives up the light-DOM data account (sub-design 8). It stays the opt-in.

## Consequences

**Good:**

- A parent's styles cannot reach a composed child's internals, by construction, so authors drop defensive `>` chains.
- The added meaning has a name (shadow-root CSS) and a testable contract, and one authored form serves every component in both modes.
- The default target never raises the baseline above the runtime's.

**Bad / accepted tradeoffs:**

- Every compiled sheet migrates mechanically from tag-led nesting to the `:host` form.
- `:host` in light DOM reads as a Shadow DOM feature, so it must be taught. A folder with a hand-written twin carries two stylesheets.
- The lowering is ours to maintain, because `lightningcss` does not lower `@scope`. Its differences from native behavior last as long as a target needs it.
- Page CSS that overrode internals through tag-plus-class specificity may need adjusting.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking), [Browser support](../REQUIREMENTS.md#browser-support)
- Architecture: [Authoring Surfaces](../ARCHITECTURE.md#authoring-surfaces), [HOST_PROFILE.md](../server/compiler/HOST_PROFILE.md) § Styles
- Related: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the verbatim emission this replaces for compiled components), [ADR 0028](0028-tiered-error-surfacing.md) s1, [ADR 0036](0036-corpus-configuration-surface.md) (the configuration surface), [ADR 0039](0039-canonical-plus-variants-authored-surfaces.md) (variant sets), [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md) (checks over the parsed sheet)
