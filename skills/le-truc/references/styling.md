# Styling

The two surfaces use **different CSS models**. Check which one you're writing. Docs: [styling](https://zeixcom.github.io/le-truc/styling.html).

## Runtime components (hand-written `.css`)

Le Truc applies no scoping to this CSS. It reaches the page exactly as written.

- **Lead every rule with the component's tag** (`my-tabs { … & button { … } }`). A bare `button { … }` styles the whole page.
- Don't style a nested component's internals (`my-parent child-tag button`). Set a custom property or a class on the child's host, and let the child read it.
- **Register CSS-only custom elements** (`customElements.define('card-callout', class extends HTMLElement {})`). If a Le Truc component queries an undefined tag through `first()`/`all()`, it waits up to 200 ms for that tag to upgrade before running its effects.

## Compiled components (`<style>{css`…`}</style>`)

A compiled sheet means what the same sheet would mean as an inline `<style>` in the host. Scope it with a prelude-less `@scope { … }`: `:scope` is the host, bare selectors are its descendants, and `to (<limits>)` stops the scope where you write it. The compiler adds no limits of its own. It emits native `@scope` (with the explicit root `@scope (my-tag)`) where the build's CSS targets support it, and a flat lowering otherwise: `:where(my-tag)`-led selectors, a bare `:scope` as the root with the same specificity, and a zero-specificity guard per limit.

**The idiom** (ADR 0033 s1): host rules at `:where(:scope)`, root variants as `&.x` inside it, descendants bare or relative, a state-dependent descendant as `:where(:scope).x .label`, and one limit per composed child.

```css
@scope to (basic-button > *) {
  :where(:scope) {
    display: block;
    &.compact { gap: 0; }
  }
  > label { font-weight: bold; }
  .label { color: var(--color-text); }
  :where(:scope).compact .label { display: none; }
}
```

It is the 2.x tag-led idiom minus one type selector, so the 2.x contests keep their winners: a parent's bare rule on the child's host beats the child's `:where(:scope)` base, the child's `&.x` variant beats the parent's rule, and a page rule led by the bare tag beats the base. A bare `:scope` (0,1,0) outranks all three. It is legal, but use it only where the host rule must win.

A rule led by the component's own tag at the top level (`my-tag .x { … }`) stays contained and emits verbatim. Any other top-level rule applies page-wide, as in any `<style>`. A parent's scoped rules reach a composed child's internals until a limit stops them. This is **not** Ripple-style hashed class scoping. No classes are generated or rewritten. Refused forms (compile errors):

| Write | Not | Code |
|---|---|---|
| `:where(:scope) { … }` | `my-tag { … }` inside `@scope` | LTC066 |
| `:where(:scope)`, `:where(:scope).x` | `:host`, `:host(.x)` | LTC086 |
| a top-level rule, with the `:global(…)` wrapper removed | `:global(…)`, `:global { … }` | LTC069 |
| a custom property or class on the child host; the child styles its own internals | a selector that descends past a compound one of the block's `to (…)` limits excludes (`to (child-tag > *)` with `child-tag .x`) | LTC071 |
| style composed children by their tag | `::slotted()` | LTC067 |
| inheritance and custom properties | `:host-context()` | LTC068 |
| a flat form: a single `@scope`, limits without `:scope` | a `@scope` inside the component `@scope`, a limit that names `:scope`, on a CSS target without native `@scope` | LTC089 |

- A qualifier after `:scope` (`:scope.x`, `:scope:hover`) is valid CSS.
- The sheet must parse (LTC064). An unknown property or value **warns** (LTC065) and still ships. The compiler's CSS dictionary lags the platform, so a newer property can trigger it.
- Every member of a variant set must have byte-identical authored CSS (LTC051).
- Limits of the light-DOM scope:
  - Page CSS can still reach in. Only a real shadow root prevents that.
  - The lowered form has no scope proximity: a nested instance of the same component is reached by the outer instance's rules too, and a tie native breaks by proximity falls to source order. Page CSS comes first in the aggregate stylesheet; the order between components is unspecified. Break a parent-versus-child tie on passed content with specificity or a limit.

## Both models

- Prefer custom states for host state: `:where(:scope):state(open)` (compiled) or `my-tag:state(open)` (runtime), driven by `bindState(internals, 'open')`. A consumer rewriting `class` cannot clear a custom state.
- Express visual variants as classes on the host (`my-button.primary`, `:where(:scope).primary`), and document them.
- Use design tokens (`var(--…)`) instead of hard-coded colors and spacing. Custom properties are the one styling channel that crosses every component boundary.
- `bindStyle(el, '--x')` with a `nil` value removes the inline property, and the cascade value comes back.
