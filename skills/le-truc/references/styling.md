# Styling

The two surfaces use **different CSS models**. Check which one you're writing. Docs: [styling](https://zeixcom.github.io/le-truc/styling.html).

## Runtime components (hand-written `.css`)

Le Truc applies no scoping to this CSS. It reaches the page exactly as written.

- **Lead every rule with the component's tag** (`my-tabs { … & button { … } }`). A bare `button { … }` styles the whole page.
- Don't style a nested component's internals (`my-parent child-tag button`). Set a custom property or a class on the child's host, and let the child read it.
- **Register CSS-only custom elements** (`customElements.define('card-callout', class extends HTMLElement {})`). If a Le Truc component queries an undefined tag through `first()`/`all()`, it waits up to 200 ms for that tag to upgrade before running its effects.

## Compiled components (`<style>{css`…`}</style>`)

Write the sheet as **shadow-root CSS**: `:host` for the host element, bare selectors for its internals. The compiler scopes it in light DOM so the rules stop at every custom element the template renders. That's native `@scope` where the build's CSS targets support it, and a zero-specificity `:where(tag)` lowering with boundary guards otherwise. Page styles still win over `:host` rules.

This is **not** Ripple-style hashed class scoping. No classes are generated or rewritten. Refused forms (compile errors):

| Write | Not | Code |
|---|---|---|
| `:host { … }` | `my-tag { … }` (rule led by the component's own tag) | LTC066 |
| `:host(.x)`, `:host(:hover)`, `:host([attr])` | `:host.x`, `:host:hover` | LTC070 |
| a custom property or class on the child host; the child styles its own internals | `child-tag .x`, `child-tag > .x` | LTC071 |
| style composed children by their tag | `::slotted()` | LTC067 |
| inheritance and custom properties | `:host-context()` | LTC068 |
| a top-level `:global(<whole selector>) { … }` or a bare `:global { … }` block (put `@media` inside it) | nested, prefixed, trailing or mid-selector `:global` | LTC069 |

- The sheet must parse (LTC064). An unknown property or value **warns** (LTC065) and still ships. The compiler's CSS dictionary lags the platform, so a newer property can trigger it.
- Every member of a variant set must compile to byte-identical CSS (LTC051).
- Limits of the light-DOM scope:
  - Page CSS can still reach in. Only a real shadow root prevents that.
  - Content that page authors put inside the component *is* styled by its rules.
  - Content this template places *inside a composed child* is outside the scope, so style it from a `:global { … }` block.
  - A custom element inserted at runtime is no boundary, because the boundary set is fixed at compile time.

## Both models

- Prefer custom states for host state: `:host(:state(open))` (compiled) or `my-tag:state(open)` (runtime), driven by `bindState(internals, 'open')`. A consumer rewriting `class` cannot clear a custom state.
- Express visual variants as classes on the host (`my-button.primary`, `:host(.primary)`), and document them.
- Use design tokens (`var(--…)`) instead of hard-coded colors and spacing. Custom properties are the one styling channel that crosses every component boundary.
- `bindStyle(el, '--x')` with a `nil` value removes the inline property, and the cascade value comes back.
