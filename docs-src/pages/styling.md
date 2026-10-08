---
title: 'Styling'
emoji: '🎨'
description: 'Scoped styles, CSS custom properties'
---

{% hero %}
# Styling

**Keep your components' styles self-contained and support shared design tokens.** Scope styles with the custom element name and expose customization via CSS custom properties. Le Truc toggles classes and attributes for you when state changes.
{% /hero %}

{% section %}
## Design Principles

Le Truc handles state management and reactivity. CSS handles everything visual. Follow three key principles:

- **Scope styles to the component**
- **Expose customization via CSS custom properties**
- **Avoid reaching inside sub-components**

A parent may style the wrapper element of a known sub-component for layout. Styling its inner elements creates tight coupling.

{% /section %}

{% section %}
## Scope Styles to Custom Element

Use the **custom element name** to scope component styles if **you control the page and the components within**. This protects against component styles leaking out. It preserves the CSS cascade. You need no Shadow DOM and no duplicate style rules.

```css
my-component {
  & button {
    /* Button style rules */
  }

  /* More selectors for inner elements */
}
```

### Advantages of Custom Element Names

- **Unique within the document** by definition, when given a descriptive name
- **Low specificity** — override it easily with a single class when needed

{% callout .tip title="When to use" %}
**Best when** you control the page and need styles to cascade naturally.
**Avoid if** you expect style clashes from third-party styles.
{% /callout %}

{% callout .note title="Compiled components are scoped for you" %}
A component compiled with the Le Truc compiler scopes its stylesheet with a native `@scope` block that you write, not with the tag-led nesting above. See [Compiled Component Styles](#compiled-component-styles) below. Hand-written CSS for a runtime-only component keeps the tag-led convention here and ships verbatim.
{% /callout %}

{% /section %}

{% section %}
## Compiled Component Styles

A compiled component's stylesheet means what the same sheet would mean as an inline `<style>` in its host. You scope it with native `@scope`. The compiler emits that meaning for your CSS targets and adds no limits of its own.

```css
@scope to (basic-button > *) {
  :where(:scope) {
    display: block;
    padding: var(--spacing);

    &.compact {
      padding: 0;
    }
  }

  > label {
    /* A direct child of the host */
  }

  .input {
    /* Any descendant of the host, except inside a <basic-button> */
  }

  :where(:scope).compact .input {
    /* A descendant, while the host has .compact */
  }
}
```

A prelude-less `@scope { … }` is scoped to the host. `:scope` is the host, and bare selectors are its descendants. Write a limit with `to (<child-tag> > *)` for each composed child whose inside your rules must not reach. The limit keeps the child's own tag stylable.

### The Idiom

- **Host rules** start at `:where(:scope)`. Root variants nest inside as `&.x`, or sit at the top as `:where(:scope).x`.
- **Descendants** are bare (`.input`) or relative (`> label`).
- **A descendant that depends on host state** leads with the variant: `:where(:scope).compact .input`.
- **Limits**: one per composed child, `to (<child-tag> > *)`.

This is the 2.x tag-led idiom minus one type selector throughout, so every specificity contest it settled keeps its winner:

- A parent's bare rule on a child's host (`basic-button { … }`) beats the child's `:where(:scope)` base.
- The child's `&.x` variant beats the parent's rule.
- A page rule led by the bare tag beats the base too.

A bare `:scope` is legal CSS with the specificity of a pseudo-class, so a `:scope { … }` rule outranks all three. Use it only where the host rule must win.

A parent's scoped rules reach the content of a composed child until a limit stops them, the same as they would on the platform. The compiler does not guess limits for you. It warns where a rule can leak.

### Top-Level Rules

Two other forms are legal at the top level of the sheet:

- **A rule led by the component's own tag** (`my-element .x { … }`) is the 2.x convention. It stays contained, because the tag is unique.
- **Any other rule** applies page-wide, as a top-level rule does in any `<style>`. A scroll lock on `body` is an example. `@keyframes`, `@font-face` and `@property` also sit at the top level.

### How the Sheet Ships

How the sheet ships depends on the build's `cssTargets` configuration (default: the Baseline widely available browsers):

- Targets that support native `@scope` get the sheet as you wrote it. A prelude-less `@scope` gains the explicit root `@scope (my-element)`.
- Older targets get a flat lowering. Every selector leads with a zero-specificity `:where(my-element)`, a bare `:scope` becomes that root with the same specificity as `:scope`, and each of your limits becomes a zero-specificity guard.

The default target set predates wide `@scope` support, so the default build compiles the lowered form. The two forms behave the same except as listed under [Differences from an Inline Sheet](#differences-from-an-inline-sheet) below. A `@scope` inside the component's `@scope`, and a limit that names `:scope`, have no flat form: they fail the build on a lowered target and name that target.

### Compile Errors

Forms that have no meaning are compile errors:

- `:host`. It matches nothing in light DOM. Write `:where(:scope)`, and `:where(:scope).x` for `:host(.x)`.
- A rule inside `@scope` led by the component's own tag. It matches only a nested instance. Write `:where(:scope)`.
- `:global`. A top-level rule is already page-wide, so remove the wrapper.
- `::slotted()` and `:host-context()`.
- A selector that descends past a compound one of the block's limits excludes. The limit always excludes its subject, so the rule matches nothing.

{% callout .caution title="Only a real shadow root keeps page styles out" %}
The compiled scope stops the component's styles from leaking **out**. It does not stop page styles from reaching **in**: page CSS can still reach the component's internals. That is the permanent light-DOM limit — only a real shadow root provides inward encapsulation.
{% /callout %}

### Differences from an Inline Sheet

The compiled sheet behaves like the same sheet inline in the host, except in two places:

- **Page CSS can still reach the component's internals.** Only a real shadow root prevents that.
- **Without native `@scope` there is no scope-proximity step.** In the lowered form, a nested instance of the same component is reached by the outer instance's rules too. The results differ only where a rule depends on the outer instance, such as `:where(:scope).compact .x`. A limit's guard re-includes a nested instance of the component's own tag, below that limit or matched by it, so the lowering gates too little and never too much.

{% callout .caution title="Ties fall to source order in the lowered form" %}
Native `@scope` breaks a specificity tie by proximity: the closer scope root wins. The lowered form has no proximity step, so the tie falls to source order. That affects two cases: a parent's and a child's rules of equal specificity on content the parent passes, and a component's and the page's rules of equal specificity on a bare element. The aggregate stylesheet puts page CSS first, so the component wins a tie with the page. The order between components is unspecified, because no order is right for every composition. Break such a tie with specificity or with a limit.
{% /callout %}

### Switching to a Shadow Root

Shadow mode is the per-component opt-in for inward isolation, and it changes more than the wrapper:

- The `@scope` block unwraps into the shadow root's `<style>`: `:scope` becomes `:host`, and the limits drop, because the shadow root bounds the scope. Top-level rules move to the document stylesheet. `::slotted()` becomes legal.
- Page-authored content renders only through slots.
- The component's children-are-data harvest stops at the shadow boundary.
- `id` references — `<label for>`, `aria-labelledby`, `aria-describedby` — no longer cross the boundary.
- Page-global styles no longer reach the internals.
- Declarative Shadow DOM is Baseline 2024: plan a connect-time fallback or a documented 2024 minimum.

You author shadow mode as a declarative shadow template — `<template shadowrootmode="open">` — as the root's first child, holding the internals and the `<style>`. Composed content still inserts where the template declares it.

{% /section %}

{% section %}
## Encapsulate Styles with Shadow DOM

Use **Shadow DOM** to encapsulate styles when you do not control the page styles where the component appears. Page styles do not leak in. Component styles do not leak out. For a compiled component, see [Switching to a Shadow Root](#switching-to-a-shadow-root) above: shadow mode changes more than the wrapper.

```html
<my-component>
  <template shadowrootmode="open">
    <style>
      button {
        /* Button style rules */
      }

      /* More selectors for inner elements */
    </style>
    <!-- Inner elements -->
  </template>
</my-component>
```

{% callout .tip title="When to use" %}
**Best when** other pages use your component in environments you do not control.
**Avoid if** you need global styles to apply inside the component.
{% /callout %}

{% /section %}

{% section %}
## Shared Design Tokens with CSS Custom Properties

Web Components cannot inherit global styles inside **Shadow DOM**. CSS custom properties let components remain **flexible and themeable**.

### Define Design Tokens

Set global tokens in a stylesheet:

```css
:root {
  --button-bg: #007bff;
  --button-text: #fff;
  --spacing: 1rem;
}
```

### Use Tokens in a Component

```css
my-component {
  padding: var(--spacing);

  & button {
    background: var(--button-bg);
    color: var(--button-text);
  }
}
```

### Advantages of CSS Custom Properties

- **Supports theming** – users can override styles globally.
- **Works inside Shadow DOM** – unlike normal CSS, custom properties are inherited inside the shadow tree.
{% /section %}

{% section %}
## Defined Variants with Classes

Use **classes** if your components can appear in a **limited set of specific manifestations**. For example, buttons could come in certain sizes. They could also have primary, secondary, and tertiary variants.

```css
my-button {
  /* Style rules for default (medium-sized, secondary) buttons */

  &.small {
    /* Style rules for small buttons */
  }

  &.large {
    /* Style rules for large buttons */
  }

  &.primary {
    /* Style rules for primary buttons */
  }

  &.tertiary {
    /* Style rules for tertiary buttons */
  }
}
```
{% /section %}

{% section %}
## Reactive Styles

Styles become interactive when JavaScript toggles a styling hook in response to state. Which hook depends on who owns the state:

- **Classes** are author-controlled. Use `watch()` + `bindClass()` when the toggled token belongs to the same vocabulary as the variant classes above. The consumer could also set or remove it by hand. The contract is simple: **the class name in CSS must exactly match the token passed to `bindClass()`**.
- **Custom states** are component-owned. Use `watch()` + `bindState()` when the state is something only the component itself can know. It is exposed to CSS via the `:state()` pseudo-class (backed by ElementInternals). Consumer code or frameworks rewriting the `class` attribute cannot overwrite it.

The `module-scrollarea` component demonstrates the custom-state case. Whether content overflows is runtime knowledge the component derives from scroll position. It is nothing an author would ever set. The CSS defines what the shadow looks like when overflow is present:

```css
module-scrollarea {
  &::after {
    opacity: 0;
    transition: opacity var(--transition-short);
    /* gradient shadow rendered here */
  }

  &:state(overflow-end)::after {
    opacity: 1; /* fades in when the component sets the state */
  }
}
```

The component's factory creates a local signal and passes it to `watch()` + `bindState()`. This uses the `internals` object from the factory context:

```js
const overflowEnd = createState(false)
watch(overflowEnd, bindState(internals, 'overflow-end'))
```

When `overflowEnd` becomes `true`, Le Truc adds `overflow-end` to the element's custom state set. The `:state(overflow-end)` rule activates. The shadow fades in. When `overflowEnd` becomes `false`, Le Truc removes the state and the shadow fades out. This approach needs:

- No inline styles
- No manual DOM manipulation
- No class token an outside script could accidentally wipe

The full example is a scroll container that shows fade shadows at either edge when content overflows: [Scrollarea example](./examples/module-scrollarea.html).

### Attribute-driven Styles

The same principle applies to attributes. Use `watch()` + `bindAttribute()` to toggle an attribute that a CSS selector targets:

```css
module-tabgroup {
  [aria-selected="true"] {
    font-weight: bold;
    border-bottom: 2px solid currentColor;
  }
}
```

```js
watch('selected', () => {
  for (const tab of tabs.get()) {
    tab.setAttribute('aria-selected',
      String(host.selected === tab.getAttribute('aria-controls')))
  }
})
```

Prefer attributes over classes when the value has semantic meaning. Screen readers and assistive technology understand `aria-selected`, `aria-expanded`, `disabled`, and similar attributes.

The full example is a tab group that uses `aria-selected` to highlight the selected tab: [Tabgroup example](./examples/module-tabgroup.html).

{% /section %}

{% section %}
## CSS-only Custom Elements

Le Truc is a JavaScript library, but that does not mean every custom element needs JavaScript. They work fine for styling alone.

Here is the `<card-callout>` example this documentation uses:

{% demo %}
```html
<card-callout>This is an informational message.</card-callout>
<card-callout class="tip">Remember to hydrate while coding!</card-callout>
<card-callout class="caution">Be careful with this operation.</card-callout>
<card-callout class="danger">This action is irreversible!</card-callout>
<card-callout class="note">This is just a side note.</card-callout>
```

{% sources title="Source code" src="./sources/card-callout.html" /%}
{% /demo %}

### Register CSS-only Custom Elements

If a Le Truc component queries for a CSS-only custom element (via `first()` or `all()`), it detects the element as an unresolved dependency. It waits for the element to upgrade. This causes an unnecessary delay before effects run.

To avoid this, register CSS-only custom elements with a trivial definition:

```js
customElements.define('card-callout', class extends HTMLElement {})
```

This tells the browser (and Le Truc) that the element is defined and ready. The registration has no runtime cost. The element simply upgrades to a plain `HTMLElement` immediately.

{% callout .caution title="Register every custom element tag" %}
Every custom element tag you use in HTML should have a corresponding `customElements.define()` call. This is the web platform's contract. A hyphenated tag name is a custom element. Defining it, even with an empty class, ensures it upgrades correctly and does not block other components.
{% /callout %}

{% /section %}
