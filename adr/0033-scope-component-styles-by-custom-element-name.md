# ADR 0033: Compiled Component CSS Is Platform CSS — Authored `@scope`, Emitted per CSS Target

## Status

✅ Accepted — owner ruling; ships in 3.0. Revised 2026-10-07 and 2026-10-08 (owner rulings). Sheet checks: [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md).

## Context

Hand-written stylesheets lead every rule with the component's tag. That stops **outward** leakage, because the tag is unique, but not **downward** leakage: a parent's `my-element .label` also matches `.label` inside a composed child.

A compiled component's `<style>` sits inside its host. The platform already gives that placement a meaning: a prelude-less `@scope { … }` in an inline `<style>` is scoped to the style's parent element, and `@scope … to (…)` sets limits. The compiler also knows what each template renders, transitively.

Emulating a shadow root with that knowledge made the emitted CSS diverge from what the author read.

## Decision

**A compiled component's stylesheet means what it would mean as an inline `<style>` in its host. Scoping is authored with native `@scope`. The compiler emits that meaning for the configured CSS target and adds no limits of its own. Its knowledge of the rendered tree surfaces as warnings, never as emitted selectors.**

1. **Three authored forms.**
   - **`@scope { … }`**, with an optional `to (<limits>)`, is scoped to the host. `:scope` is the host, and bare selectors are its descendants. The limits are exactly the ones authored. The idiom roots host rules at `:where(:scope)`, writes descendants bare and lists a limit per composed child. That is the 2.x tag-led idiom minus one type selector throughout, so every contest it settled keeps its winner: a parent's rule beats a child's base host rule, and a child's host variant (`&.x`) beats the parent's.
   - **Rules led by the component's own tag** (`my-element .x`) at the top level emit verbatim. That is the 2.x convention, contained by the unique tag.
   - **Any other top-level rule** emits verbatim and applies page-wide, as a top-level rule in any `<style>` does. The compiler warns (point 5). `@keyframes`, `@font-face` and `@property` emit verbatim.

2. **One meaning in both emissions.** The compiled sheet behaves like the same sheet inline in the host, on the platform. Page-authored children and content a compiled parent passes style alike. The native emission is that meaning. The lowered emission differs from it in one documented way (point 4).

3. **Native emission** (`@scope` target). The sheet moves out of the host into the component's stylesheet, so the prelude-less `@scope` gains the explicit root `@scope (my-element)` and keeps the authored `to (…)`. A relative selector at the block's top takes its implicit anchor, `:where(:scope) > p`, which lightningcss-based bundlers require. Everything else emits verbatim.

4. **Lowered emission** (no `@scope`). The output is flat selectors. The scope root leads as `:where(my-element)`, and each authored limit becomes a zero-specificity guard. Specificity matches the native form. The lowering cannot express scope proximity, which is its one difference from native:
   - A nested instance of the same component is reached by the outer instance's rules too. The sheet is the same, so the results differ only where a rule depends on the outer instance (`:scope.compact .x`).
   - Ties that native breaks by proximity (parent and child rules on passed content, a component and the page on a bare element) fall to source order. An aggregate stylesheet puts page CSS first. Component order is unspecified: no order is right for every composition, so the lowering does not emulate proximity. HOST_PROFILE § Styles documents the hazard.
   - A guard for an authored limit re-includes a nested instance of the component's own tag below that limit, and its subtree. A guard that excluded it would leave the inner instance unstyled. The lowering gates too little, never too much.

   A `@scope` form the lowering cannot express in a component sheet is a build error that names the CSS target (Prevented). It never emits a silent approximation.

5. **Warnings come from the compiler's knowledge.** Channel: compiler. Tier: Contained ([ADR 0028](0028-tiered-error-surfacing.md) s1), so the CSS ships as authored.
   - **Downward leak.** A scoped rule whose subject can match an element a composed child renders in its own template, with no authored limit excluding it. The warning names the child and the fix, `to (<child-tag> > *)`, which keeps the child's own tag stylable. Content the component passes as `children` is its own markup, not a leak ([ADR 0048](0048-the-children-contract-parent-owned-content-child-declared-roles.md)).
   - **Unscoped rule.** A top-level rule that is not led by the component's own tag and does not sit in `@scope`.

   No warning fires for a missing limit as such.

6. **Authored forms with no meaning are errors.** Channel: compiler. Tier: Prevented. Each form is statically decidable and never correct.
   - `:host` in light mode: it matches nothing outside a shadow root. The fix-it names `:scope`.
   - A rule inside `@scope` led by the component's own tag: the implicit `:scope` prefix makes it match only a nested instance. The fix-it names `:scope`.
   - A selector whose subject an authored limit always excludes: a dead rule.
   - `::slotted()` in light mode, and `:host-context()` in either mode (it is removed from the spec).
   - A malformed sheet (point 8).

   TSRX's `:global` has no meaning here, because an unscoped rule is written as a top-level rule. It is an error whose fix-it removes the wrapper.

7. **The CSS target is configurable and defaults to Baseline widely available.** The `cssTargets` key in `le-truc.config.json` ([ADR 0036](0036-corpus-configuration-surface.md)) maps browser names to minimum versions. The default is pinned at 3.0, moves only with a major version, and lowers until a bump crosses native `@scope` support.

8. **The stylesheet is parsed, not dedented.** The sheet goes through a `lightningcss-wasm` parse that is portable across runtimes ([ADR 0038](0038-runtime-neutral-build-path.md)). A parse error is Prevented. A declaration outside the CSS grammar is Contained and ships as authored, because the parser lags the platform. Emission rewrites selector text and never round-trips nodes through the parser.

9. **Shadow mode translates the sheet. It is the opt-in for inward isolation.** Only a shadow root keeps page CSS out of a component. In shadow mode, the `@scope` block unwraps into the shadow root's `<style>`, `:scope` becomes `:host`, and the limits drop, because the shadow root bounds the scope. Top-level rules move to the document stylesheet. `::slotted()` becomes legal. HOST_PROFILE § Styles lists its caveats. The mode is unscheduled.

10. **Hand-written twin CSS splits off.** A compiled surface serves the emitted CSS. The twin's hand-written `.css` is served only with the twin. Variant-set CSS identity compares the compiled members' authored sheets.

11. **Upstream's hash-class scoping is not adopted.** It is a client-transform mechanism with no server-render counterpart.

## Alternatives Considered

- **Shadow-root CSS emulated in light DOM** (the first design): the compiler-derived limits, re-includes and nesting patches gave authored CSS a meaning that was visible only in the emission. Lowered, it cost up to 10 kB raw per component.
- **Compiler-derived limits added to authored `@scope`**: the same hidden meaning in a smaller form. The compiler's knowledge is better spent naming the leak.
- **Auto-wrap tag-led sheets**: one authored form, two unmarked behaviors.
- **`:scope` as the host idiom**: shorter, but raising the root while bare descendants drop inverts the 2.x parent-over-child-host contest.
- **An SCSS-like abstraction language**: no editor support.
- **Native `@scope` only**: excludes projects with older targets.
- **Shadow DOM as the default**: forces slots onto every composition. Opt-in only.

## Consequences

**Good:**

- What the author reads is what the platform does. Native emission is the authored sheet with an explicit root, and the lowering mirrors one platform construct.
- The compiler's knowledge arrives as a warning naming the leaking rule, the child and the fix.
- The lowering shrinks to nothing as targets cross native `@scope` support.

**Bad / accepted tradeoffs:**

- Authors write their limits themselves. A parent's scoped rules reach a composed child's internals until a limit stops them, and the warning is the safety net.
- The idiom's `:where(:scope)` is longer than `:scope`, and nothing enforces it. A bare `:scope` (0,1,0) host rule outranks a parent's bare rule on that host. A lint waits for real conflicts.
- Shadow mode needs a translation step (`:scope` to `:host`, limits dropped).
- Every compiled sheet migrates mechanically: wrap it in `@scope { }`, rename `:host` to `:where(:scope)`, and hoist descendant rules out of the host block.
- The lowering lacks scope proximity, and it is ours to maintain because `lightningcss` does not lower `@scope`.
- A folder with a hand-written twin carries two stylesheets.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking), [Browser support](../REQUIREMENTS.md#browser-support)
- Architecture: [Authoring Surfaces](../ARCHITECTURE.md#authoring-surfaces), [HOST_PROFILE.md](../server/compiler/HOST_PROFILE.md) § Styles
- Related: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the verbatim emission this keeps for unscoped rules), [ADR 0028](0028-tiered-error-surfacing.md) s1, [ADR 0036](0036-corpus-configuration-surface.md) (the configuration surface), [ADR 0039](0039-canonical-plus-variants-authored-surfaces.md) (variant sets), [ADR 0042](0042-the-component-stylesheet-as-a-compiler-artifact.md) (checks over the parsed sheet), [ADR 0048](0048-the-children-contract-parent-owned-content-child-declared-roles.md) (children ownership, which no longer carries style meaning)
