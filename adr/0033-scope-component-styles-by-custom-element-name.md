# ADR 0033: Compiled Component CSS Is Shadow-Root CSS — Scoped in Light DOM, Emitted per CSS Target

## Status

✅ Accepted — owner ruling 2026-09-24, revised the same day from an auto-wrap over tag-led sheets to the shadow-root authored form. It replaces the 2026-09-18 draft (tag-name nesting as a convention, parked on TSRX 1.0), which was never published. That draft's parsed-stylesheet checks (dead rules, the typed custom-property seam, the typed class handle) move to [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md), and style composition stays on the [ROADMAP](../ROADMAP.md). Ships in 3.0. Implementation: LT-268 (parse), LT-304 (scoped emission), LT-306 (corpus migration), LT-248 (docs).

## Context

Hand-written Le Truc stylesheets lead every rule with the component's tag. That stops **outward** leakage, because the custom-element registry makes the tag unique. It does not stop **downward** leakage: a parent's `my-element .label` also matches `.label` inside a composed child, because the child's markup is part of the parent's light DOM. The corpus avoids this only by `>`-chain discipline (`form-combobox`'s `> .input > input` beside `form-listbox`'s own `.input`), which ties CSS to exact DOM depth and which nothing checks. The owner's verdict: the discipline comes from scars, and discipline is error-prone.

The compiler knows what no author and no runtime knows: which custom elements each template renders. That is exactly the boundary downward containment needs. But a compiler that silently changes what valid, tag-led CSS means would make the same authored form behave differently compiled and hand-written. The authored form for compiled components must therefore have a meaning of its own, which the compiler then implements. That meaning must also not raise the browser baseline above the runtime's ([REQUIREMENTS § Browser support](../REQUIREMENTS.md#browser-support)).

## Decision

**A compiled component's stylesheet is authored as shadow-root CSS: `:host` for the host element, bare selectors for its internals. The compiler gives it shadow-root scoping in light DOM, with rules stopping at the custom elements the template renders. It emits native `@scope` where the configured CSS target supports it, and a flat-selector lowering where it does not.**

1. **The contract.** Compiled light-DOM output behaves like the same sheet inside a shadow root, except for the differences in sub-design 7. This is the meaning the compiler adds, the same kind of well-known magic as auto-scoping in most JS frameworks, and it is what the fixtures test. Hand-written CSS for runtime-only components is always emitted verbatim, and keeps its 2.x meaning.

2. **The authored form** is the same for leaf and composing components, and for light and shadow mode:

   ```css
   :host { … }
   .input { … }         /* cannot reach form-listbox's .input */
   form-listbox { … }   /* the child's host stays stylable */
   ```

3. **Native emission** (the target supports `@scope`): the sheet is wrapped in `@scope (my-element) to (<boundary> > *)`, where the boundary is every custom-element tag the lowered template renders, composed and raw dashed tags alike. The `> *` form keeps the child's host element in scope and excludes its contents. A leaf component gets `@scope (my-element)` with no `to`. `:host` is emitted as `:where(:scope)` and `:host(<sel>)` as `:where(:scope:is(<sel>))`, so the host rules carry zero specificity and page styles win over them, as they do over `:host` in a shadow root. `@keyframes`, `@font-face` and `@property` are hoisted out unchanged, since they are global by nature, and so are rules marked `:global` (sub-design 6a).

4. **Lowered emission** (the target lacks `@scope`): each rule becomes a flat selector with the scope root as its leading term and a zero-specificity guard per boundary tag, for example `my-element .input:where(:not(my-element form-listbox > *, my-element form-listbox > * *))`; `:host` becomes `:where(my-element)`. `:where()` and complex `:not()` are Baseline 2021, so compiled components stay within the runtime's baseline.

5. **The CSS target is configurable and defaults to Baseline widely available.** A browserslist-style `cssTargets` key in `le-truc.config.json` ([ADR 0036](0036-corpus-configuration-surface.md)) feeds both this choice and `lightningcss`'s own lowering, nesting included. With the default, `@scope` is lowered until it becomes widely available (about 2028).

6. **Authored forms with no meaning under the contract are errors.** Each is **channel compiler, tier 1 Prevented** (ADR 0028 s1; statically decidable, and never correct), with Tech Writer owning the copy:
   - A rule led by the component's own tag. Inside `@scope (my-element)`, `my-element { … }` matches only descendants of that name, so it would silently stop styling the host. The fix-it names `:host`.
   - `::slotted()` in light mode, which has no light-DOM meaning, and `:host-context()` in either mode, which the CSS Working Group removed from the specification.
   - `:global` in any form other than the two below (sub-design 6a).
   - A malformed sheet (sub-design 9).

   **6a. The escape hatch is TSRX's `:global`, restricted to whole rules.** Two forms are admitted, both at the top level of the sheet: `:global(<selector>) { … }`, where the entire selector is inside the parentheses, and the block `:global { … }`, where every rule inside is global. Both are emitted verbatim outside the scope. The case they serve is a page-level rule that ships with the component, such as `module-dialog`'s `body.scroll-lock`. "Conditional on the component" means bundling: the rule applies wherever the component's CSS is included, with no runtime condition. Every other TSRX form is a tier 1 error, because each one either means something here that it does not mean in TSRX, or has no shadow-root meaning:
   - a nested `:global { … }` block, or a prefixed `.card :global(.footnote)`, would reach past the scope boundary into composed children's markup, which data-account bullet 3 forbids;
   - a trailing `.card:global(.is-open)` is a no-op, since classes are never rewritten (the fix-it names `.card.is-open`);
   - a leading `:global(.theme-dark) .card` has no shadow-root equivalent now that `:host-context()` is gone, so a sheet using it could not switch modes. Page-driven theming uses custom properties, which cross every boundary;
   - `:global(…)` in the middle of a selector is an error in TSRX too (`tsrx-css-global-placement`).

7. **The documented differences from a real shadow root**, each pinned by a fixture:
   - **Inward reach**: page CSS can still reach a component's internals (`form-combobox .input`). Only a real shadow root prevents that; this is the permanent light-DOM limit, and the docs say so plainly.
   - **Page-authored children** inside the host are styled by the component's rules. That is intended in light DOM, where nothing is slotted.
   - **Old targets**: where the lowering is emitted, it has no scope-proximity step in the cascade, a component nested inside another instance of itself may compute the boundary slightly differently, and neither form covers children inserted at runtime (`dangerouslyBindInnerHTML`, page-authored content).

8. **Shadow DOM is the opt-in for inward isolation, and it is not only a wrapper change.** The stylesheet is identical in both modes, and in shadow mode it is emitted verbatim into the shadow root's `<style>` (moved inside the declarative template by the compiler), with `::slotted()` then legal and `:global` rules moved to the document stylesheet, since a global rule cannot live inside a shadow root. The runtime is already shadow-aware (`first()`/`all()` query `host.shadowRoot ?? host`). What does change, and what the future task must design for:
   - page-authored content renders only through `<slot>`s in the template;
   - children-are-data harvest from light children stops working, because the queries target the shadow root;
   - ID references cannot cross the boundary (`<label for>`, `aria-labelledby`, `aria-describedby`), which matters most for form components;
   - page-global styles no longer reach the internals, only inherited and custom properties do;
   - Declarative Shadow DOM is Baseline 2024, above the 2023 pin, so the opt-in needs a connect-time fallback or a documented 2024 minimum.

   The authored spelling (a config flag or a literal `<template shadowrootmode>`) is unbuilt and unscheduled.

9. **The stylesheet is parsed, not dedented.** Emission needs the sheet's rules and selectors, so `css.ts`'s dedent gives way to a `lightningcss` parse (already a devDependency and the build's CSS effect). A parse or grammar error is tier 1 Prevented: the sheet is the compiler's own input, and a malformed one has no correct emission. ADR 0042 builds its checks on this parse.

10. **Hand-written twin CSS splits off.** Where a folder serves a compiled surface, the page imports the compiler's emitted CSS. The `.ts` twin's hand-written `.css` stays the 2.x-style artifact, served only when the twin is. Variant-set CSS identity (LTC051) keeps comparing the compiled members' authored sheets.

11. **Upstream's hash-class scoping is not adopted.** It is a client-transform mechanism with no server-render counterpart, it puts hash classes into every served byte, and it erodes the compose-site `class`/`id` discriminators (`first('form-spinbutton.lightness')`).

## Alternatives Considered

- **Auto-wrap tag-led sheets (this ADR's first 2026-09-24 ruling)**: rejected on revision. It changes what valid, tag-led CSS means only when the compiler is involved, so the same authored form behaves differently compiled and hand-written, with nothing in the source to say so.
- **Authors write `@scope` themselves, the compiler checks the `to` list and lowers it**: rejected. It keeps authored CSS literal, but makes every composing parent restate a boundary the compiler already knows, and leaf and composing components would be authored differently.
- **An abstraction language (SCSS-like)**: rejected. No LSP or syntax-highlighting support.
- **Verbatim emission with no scoping**: rejected. Honest, but it keeps the downward-leakage footgun and leaves the compiler's knowledge unused.
- **Native `@scope` only**: rejected. `@scope` is only newly available in Baseline (Firefox shipped it last, in late 2025); native-only emission would exclude projects with older targets, including Firefox ESR users.
- **Hash classes (Ripple parity)**: rejected per sub-design 11.
- **The full TSRX `:global` vocabulary**: rejected. Only the whole-rule forms keep their TSRX meaning and work in both modes (sub-design 6a).
- **No escape hatch (page-wide rules only in a page stylesheet)**: rejected. A page-level rule that belongs to one component, like a scroll lock, would have to live apart from it.
- **Shadow DOM as the default**: rejected. It forces slots onto every composition and gives up the light-DOM data account (sub-design 8); it stays the opt-in.

## Consequences

**Good:**
- A parent's styles cannot reach a composed child's internals, by construction, and authors drop defensive `>` chains.
- The added meaning has a name (shadow-root CSS) and a testable contract, rather than being an unexplained rewrite.
- One authored form serves leaf and composing components, and light and shadow mode.
- Consumer projects choose their CSS target, and the default never raises the baseline above the runtime's.

**Bad:**
- Every compiled sheet in the corpus migrates from tag-led nesting to the `:host` form (LT-306). It is mechanical, but it touches every compiled component.
- `:host` in a light-DOM component reads as a Shadow DOM feature, and has to be taught.
- Compiled and hand-written sheets for the same component differ, so a folder with a `.ts` twin carries two stylesheets.
- The lowering is ours to maintain, since `lightningcss` does not lower `@scope`, and its differences from native behavior are permanent while a target needs it.
- Page CSS that overrode a component's internals through tag-plus-class specificity may need adjusting.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking), [Browser support](../REQUIREMENTS.md#browser-support)
- Architecture: [Authoring Surfaces](../ARCHITECTURE.md#authoring-surfaces) (CSS bullet), `server/compiler/HOST_PROFILE.md` § Styles
- [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md) (checks over the parsed sheet), [ADR 0036](0036-corpus-configuration-surface.md) (the configuration surface), [ADR 0039](0039-canonical-plus-variants-authored-surfaces.md) (variant sets), [ADR 0028](0028-tiered-error-surfacing.md) s1 (channel and tier accounting), [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the verbatim emission this replaces for compiled components)
