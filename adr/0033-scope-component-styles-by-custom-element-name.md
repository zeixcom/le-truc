# ADR 0033: Compiled Component CSS Is Shadow-Root CSS — Scoped in Light DOM, Emitted per CSS Target

## Status

✅ Accepted — owner ruling; ships in 3.0. Checks over the parsed sheet live in [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md); style composition stays on the [ROADMAP](../ROADMAP.md).

## Context

Hand-written stylesheets lead every rule with the component's tag. That stops **outward** leakage — the registry makes the tag unique — but not **downward** leakage: a parent's `my-element .label` also matches `.label` inside a composed child. The corpus avoids this only by `>`-chain discipline, tying CSS to exact DOM depth. Nothing checks it, and discipline is error-prone.

The compiler knows what no author and no runtime knows: which custom elements each template renders — exactly the boundary downward containment needs. But silently changing what valid, tag-led CSS means would make one authored form behave differently compiled and hand-written. The authored form must have a meaning of its own, which the compiler implements without raising the browser baseline above the runtime's.

## Decision

**A compiled component's stylesheet is authored as shadow-root CSS: `:host` for the host element, bare selectors for its internals. The compiler gives it shadow-root scoping in light DOM, rules stopping at the custom elements the template renders; native `@scope` where the CSS target supports it, a flat-selector lowering where not.**

1. **The contract.** Compiled light-DOM output behaves like the same sheet in a shadow root, except the documented differences (sub-design 7) — well-known magic like framework auto-scoping, and what the fixtures test. Hand-written CSS for runtime-only components emits verbatim, keeping its 2.x meaning.

2. **The authored form** is the same for leaf and composing components, light and shadow mode: `:host` rules style the host, bare class and element selectors style the internals, the composed child's own tag stays stylable — a `.input` rule cannot reach a composed child's `.input`.

3. **Native emission** (`@scope` target): the sheet wraps in `@scope (my-element) to (<boundary> > *)` — the boundary being every custom-element tag the template renders; `> *` keeps the child's host in scope, excludes its contents; a leaf gets no `to`. `:host` emits as `:where(:scope)` — zero specificity, page styles win as over `:host` in a shadow root; `@keyframes`/`@font-face`/`@property`/`:global` hoist out unchanged.

4. **Lowered emission** (no `@scope`): flat selectors, scope root leading, a zero-specificity guard per boundary tag; `:host` becomes `:where(my-element)`. `:where()` and complex `:not()` are Baseline 2021 — within the runtime's baseline.

5. **The CSS target is configurable and defaults to Baseline widely available.** A browserslist-style `cssTargets` key in `le-truc.config.json` ([ADR 0036](0036-corpus-configuration-surface.md)) feeds both this choice and `lightningcss`'s own lowering; with the default, `@scope` lowers until widely available.

6. **Authored forms with no meaning under the contract are errors** — **channel compiler, Prevented** ([ADR 0028](0028-tiered-error-surfacing.md) s1; statically decidable, never correct): a rule led by the component's own tag (inside the scope it would silently stop styling the host — the fix-it names `:host`); `::slotted()` in light mode; `:host-context()` in either mode (removed from the spec); `:global` in any other form than 6a's; a malformed sheet (sub-design 9).

   **6a. The escape hatch is TSRX's `:global`, restricted to whole rules.** Two top-level forms are admitted — `:global(<selector>)` with the whole selector inside the parentheses, and a `:global` block — both emitted verbatim outside the scope. They serve the page-level rule shipping with a component (a scroll lock on `body`); "conditional on the component" means bundling — wherever the component's CSS is included, no runtime condition. Every other TSRX form is a Prevented error: nested or prefixed uses would reach past the boundary into composed children's markup (the data account forbids it); a trailing use is a no-op, classes never rewritten; a leading use has no shadow-root equivalent — theming uses custom properties, which cross every boundary; a mid-selector use is an error in TSRX too.

7. **The documented differences from a real shadow root**, each fixture-pinned: **inward reach** — page CSS can still reach a component's internals; only a real shadow root prevents that, the permanent light-DOM limit, stated in the docs. **Page-authored children** are styled by the component's rules — intended where nothing is slotted. **Old targets**: no scope-proximity step; a self-nested component may compute the boundary slightly differently. **In either form**, children inserted at runtime are uncovered.

8. **Shadow DOM is the opt-in for inward isolation, and not only a wrapper change.** The stylesheet is identical in both modes; in shadow mode it emits verbatim into the shadow root's `<style>`, `::slotted()` becomes legal, and `:global` rules move to the document stylesheet (a global rule cannot live in a shadow root). The runtime is already shadow-aware (`first()`/`all()` query `host.shadowRoot ?? host`). Shadow-mode authoring must design for: page-authored content rendering only through slots; children-are-data harvest stopping; ID references not crossing the boundary (`<label for>`, `aria-labelledby`, `aria-describedby`); page-global styles not reaching internals; Declarative Shadow DOM being Baseline 2024 — a connect-time fallback or a documented 2024 minimum. The authored spelling is unbuilt and unscheduled.

9. **The stylesheet is parsed, not dedented.** Emission needs the rules and selectors, so the dedent gives way to a `lightningcss` parse; a parse error is Prevented — a malformed sheet has no correct emission. [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md) builds on this parse.

10. **Hand-written twin CSS splits off.** Where a folder serves a compiled surface, the page imports the emitted CSS; the twin's hand-written `.css` stays the 2.x artifact, served only when the twin is. Variant-set CSS identity (LTC051) compares compiled members' authored sheets.

11. **Upstream's hash-class scoping is not adopted.** It is a client-transform mechanism with no server-render counterpart, puts hash classes into every served byte, and erodes the compose-site `class`/`id` discriminators.

## Alternatives Considered

- **Auto-wrap tag-led sheets**: changes what valid, tag-led CSS means only when the compiler is involved — one authored form, two behaviors, nothing in the source saying so.
- **Authors write `@scope` themselves**: every composing parent restates a boundary the compiler already knows, and leaf and composing components author differently.
- **An abstraction language (SCSS-like)**: no LSP or syntax-highlighting support.
- **Verbatim emission, no scoping**: keeps the downward-leakage footgun and leaves the compiler's knowledge unused.
- **Native `@scope` only**: newly Baseline (Firefox last) — excludes projects with older targets.
- **No escape hatch**: a page-level rule belonging to one component would live apart from it.
- **Shadow DOM as the default**: forces slots onto every composition and gives up the light-DOM data account (sub-design 8); it stays the opt-in.

## Consequences

**Good:**

- A parent's styles cannot reach a composed child's internals, by construction — authors drop defensive `>` chains; the added meaning has a name (shadow-root CSS) and a testable contract; one authored form serves leaf and composing components, light and shadow mode; the default target never raises the baseline above the runtime's.

**Bad / accepted tradeoffs:**

- Every compiled sheet migrates from tag-led nesting to the `:host` form — mechanical, touching every compiled component.
- `:host` in light DOM reads as a Shadow DOM feature, taught not assumed; compiled and hand-written sheets for the same component differ, so a folder with a twin carries two stylesheets.
- The lowering is ours to maintain — `lightningcss` does not lower `@scope` — and its differences from native behavior are permanent while a target needs it.
- Page CSS that overrode a component's internals through tag-plus-class specificity may need adjusting.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking), [Browser support](../REQUIREMENTS.md#browser-support)
- Architecture: [Authoring Surfaces](../ARCHITECTURE.md#authoring-surfaces), [HOST_PROFILE.md](../server/compiler/HOST_PROFILE.md) § Styles
- Related: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the verbatim emission this replaces for compiled components), [ADR 0028](0028-tiered-error-surfacing.md) s1, [ADR 0036](0036-corpus-configuration-surface.md) (the configuration surface), [ADR 0039](0039-canonical-plus-variants-authored-surfaces.md) (variant sets), [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md) (checks over the parsed sheet)
