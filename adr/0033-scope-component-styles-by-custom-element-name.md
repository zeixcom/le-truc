# ADR 0033: Compiled Component CSS Is Platform CSS — Authored `@scope`, Emitted per CSS Target

## Status

✅ Accepted — owner ruling; ships in 3.0. Revised 2026-10-07 (owner ruling). Checks over the parsed sheet live in [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md); style composition stays on the [ROADMAP](../ROADMAP.md).

## Context

Hand-written stylesheets lead every rule with the component's tag. That stops **outward** leakage, because the tag is unique, but not **downward** leakage: a parent's `my-element .label` also matches `.label` inside a composed child.

A compiled component's `<style>` sits inside its host. The platform already gives that placement a meaning: a prelude-less `@scope { … }` in an inline `<style>` is scoped to the style's parent element, and `@scope … to (…)` sets limits. The compiler also knows which custom elements each template renders, and what each of them renders.

Using that knowledge to emulate a shadow root in light DOM made the emitted CSS diverge from what the author read: authors could not predict which rules applied without reading the emission.

## Decision

**A compiled component's stylesheet means what it would mean as an inline `<style>` in its host. Scoping is authored with native `@scope`. The compiler emits that meaning for the configured CSS target and adds no limits of its own. Its knowledge of the rendered tree surfaces as warnings at concrete leaks, never as emitted selectors.**

1. **Three authored forms.**
   - **`@scope { … }`**, with an optional `to (<limits>)`, is scoped to the host. `:scope` is the host, and bare selectors are its descendants. The limits are exactly the ones authored.
   - **Rules led by the component's own tag** (`my-element .x`) at the top level emit verbatim. That is the 2.x convention: contained outward by the unique tag, with no warning.
   - **Any other top-level rule** emits verbatim and applies page-wide, as a top-level rule in any `<style>` does. The compiler warns (point 5). `@keyframes`, `@font-face` and `@property` emit verbatim.

2. **One meaning in both emissions.** The compiled sheet behaves like the same sheet inline in the host, on the platform. Page-authored children and content a compiled parent passes are both descendants and style alike, so the page-versus-compiled difference does not exist. The native emission is that meaning. The lowered emission differs from it in one documented way (point 4).

3. **Native emission** (`@scope` target). The sheet moves out of the host into the component's stylesheet, so the prelude-less `@scope` gains the explicit root `@scope (my-element)` and keeps the authored `to (…)`. For a component sheet the two are the same: scope proximity resolves nested instances exactly as it would for the inline form. Everything else emits verbatim.

4. **Lowered emission** (no `@scope`). The output is flat selectors. The scope root leads as `:where(my-element)`, and each authored limit becomes a zero-specificity guard. Specificity matches the native form. The lowering cannot express scope proximity, which is its one difference from native:
   - A nested instance of the same component is reached by the outer instance's rules too. The sheet is the same, so the results differ only where a rule depends on the outer instance (`:scope.compact .x`).
   - A guard for an authored limit re-includes a nested instance of the component's own tag below that limit, and its subtree. A guard that excluded it would leave the inner instance unstyled. The lowering gates too little, never too much.

   A `@scope` form the lowering cannot express in a component sheet is a build error that names the CSS target (Prevented). It never emits a silent approximation.

5. **Leak warnings come from the compiler's knowledge.** Channel: compiler. Tier: Contained ([ADR 0028](0028-tiered-error-surfacing.md) s1), so the CSS ships as authored.
   - **Downward leak.** A scoped rule whose subject can match an element a composed child renders in its own template, with no authored limit excluding it. The warning names the child and the fix, `to (<child-tag> > *)`, which keeps the child's own tag stylable. Content the component passes as `children` is its own markup, not a leak ([ADR 0048](0048-the-children-contract-parent-owned-content-child-declared-roles.md)).
   - **Unscoped rule.** A top-level rule that is not led by the component's own tag and does not sit in `@scope`.

   No warning fires for a missing limit as such. A component that composes nothing needs none.

6. **Authored forms with no meaning are errors.** Channel: compiler. Tier: Prevented. Each form is statically decidable and never correct.
   - `:host` in light mode: it matches nothing outside a shadow root. The fix-it names `:scope`.
   - A rule inside `@scope` led by the component's own tag: the implicit `:scope` prefix makes it match only a nested instance. The fix-it names `:scope`.
   - A selector whose subject an authored limit always excludes: a dead rule.
   - `::slotted()` in light mode, and `:host-context()` in either mode (it is removed from the spec).
   - A malformed sheet (point 8).

   TSRX's `:global` has no meaning here, because an unscoped rule is written as a top-level rule. It is an error whose fix-it removes the wrapper.

7. **The CSS target is configurable and defaults to Baseline widely available.** The `cssTargets` key in `le-truc.config.json` ([ADR 0036](0036-corpus-configuration-surface.md)) maps browser names to minimum versions. A browser left out imposes no constraint. The default is a fixed version set, pinned at 3.0 and moved only with a major version. The default lowers until a deliberate bump crosses native `@scope` support.

8. **The stylesheet is parsed, not dedented.** Emission needs the rules and selectors, so the sheet goes through a `lightningcss-wasm` parse that is portable across runtimes ([ADR 0038](0038-runtime-neutral-build-path.md)). A parse error is Prevented. A declaration outside the CSS grammar is Contained and ships as authored, because the parser's property dictionary lags the platform. The parse is read-only: emission rewrites selector text and never round-trips nodes through the parser's write path.

9. **Shadow mode translates the sheet. It is the opt-in for inward isolation.** Only a shadow root keeps page CSS out of a component. In shadow mode, the `@scope` block unwraps into the shadow root's `<style>`, `:scope` becomes `:host`, and the limits drop, because the shadow root bounds the scope. Top-level rules move to the document stylesheet. `::slotted()` becomes legal. Its authoring limits (slots, the children-are-data harvest, ID references) are listed in HOST_PROFILE § Styles. The mode is unscheduled.

10. **Hand-written twin CSS splits off.** A compiled surface serves the emitted CSS. The twin's hand-written `.css` stays the 2.x artifact and is served only with the twin. Variant-set CSS identity compares the compiled members' authored sheets.

11. **Upstream's hash-class scoping is not adopted.** It is a client-transform mechanism with no server-render counterpart. It also puts hash classes into every served byte.

## Alternatives Considered

- **Shadow-root CSS emulated in light DOM** (the first design): the compiler-derived limits, re-includes and nesting patches gave authored CSS a meaning that was visible only in the emission. It cost up to about 10 kB raw per component in the lowered form, and it needed exceptions for page-rendered instances and root insertion.
- **Compiler-derived limits added to authored `@scope`**: the same hidden meaning in a smaller form. The compiler's knowledge is better spent naming the leak.
- **Auto-wrap tag-led sheets**: one authored form with two behaviors, compiled and hand-written, and nothing in the source says so.
- **An SCSS-like abstraction language**: no LSP or highlighting support.
- **Native `@scope` only**: excludes projects with older targets.
- **Shadow DOM as the default**: forces slots onto every composition and gives up the light-DOM data account. It stays the opt-in.

## Consequences

**Good:**

- What the author reads is what the platform does. Native emission is the authored sheet with an explicit root, and the lowering mirrors one platform construct.
- A component styles its content the same way under a page and under a compiled parent.
- The compiler's knowledge of the rendered tree arrives as a warning that names the leaking rule, the child and the fix.
- The lowering shrinks to nothing as targets cross native `@scope` support.

**Bad / accepted tradeoffs:**

- Authors write their limits themselves. A parent's scoped rules reach a composed child's internals until a limit stops them, and the warning is the safety net.
- `:scope` carries pseudo-class specificity, so a scoped host rule beats a page rule led by the bare tag. That is platform behavior; authors who want page styles to win write `:where(:scope)`.
- Shadow mode needs a translation step (`:scope` to `:host`, limits dropped).
- Every compiled sheet migrates mechanically: wrap it in `@scope { }` and rename `:host` to `:scope`.
- The lowering lacks scope proximity, and it is ours to maintain because `lightningcss` does not lower `@scope`.
- A folder with a hand-written twin carries two stylesheets.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking), [Browser support](../REQUIREMENTS.md#browser-support)
- Architecture: [Authoring Surfaces](../ARCHITECTURE.md#authoring-surfaces), [HOST_PROFILE.md](../server/compiler/HOST_PROFILE.md) § Styles
- Related: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the verbatim emission this keeps for unscoped rules), [ADR 0028](0028-tiered-error-surfacing.md) s1, [ADR 0036](0036-corpus-configuration-surface.md) (the configuration surface), [ADR 0039](0039-canonical-plus-variants-authored-surfaces.md) (variant sets), [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md) (checks over the parsed sheet), [ADR 0048](0048-the-children-contract-parent-owned-content-child-declared-roles.md) (children ownership, which no longer carries style meaning)
