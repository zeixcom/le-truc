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
A component compiled with the Le Truc compiler scopes its stylesheet automatically. You author shadow-root CSS (`:host` plus bare selectors), not the tag-led nesting above. See [Compiled Component Styles](#compiled-component-styles) below. Hand-written CSS for a runtime-only component keeps the tag-led convention here and ships verbatim.
{% /callout %}

{% /section %}

{% section %}
## Compiled Component Styles

A component compiled with the Le Truc compiler ships its stylesheet **scoped**. You author the sheet as **shadow-root CSS**: `:host` rules style the host element, and bare selectors style the component's internals.

```css
:host {
  display: block;
  padding: var(--spacing);
}

.input {
  /* Styles for the component's own internals */
}
```

The compiler scopes this sheet in light DOM. Its rules stop at every custom element the template renders, so they cannot reach a composed child's internals. You need no defensive `>` chains. Page styles still win over `:host` rules, as they do over a component in a real shadow root.

How the sheet ships depends on the build's `cssTargets` configuration (default: the Baseline widely available browsers):

- Targets that support native `@scope` get the sheet wrapped in `@scope (my-element) to (…)`.
- Older targets get a flat lowering: every selector leads with a zero-specificity `:where(my-element)`, plus a guard per boundary tag.

The default target set predates wide `@scope` support, so the default build compiles the lowered form. The two forms behave the same except as listed under [Differences from a Real Shadow Root](#differences-from-a-real-shadow-root) below.

A page-level rule that ships with the component — a scroll lock on `body`, for example — opts out with `:global`. A top-level `:global(body.scroll-lock) { … }` rule or a bare `:global { … }` block ships outside the scope, unwrapped. A global rule under a condition, such as `@media`, rides in the bare block: `:global { @media … }`. Every other `:global` spelling is a compile error: it would reach past the boundary into composed children.

Forms that have no meaning under the contract are compile errors too: a rule led by the component's own tag (style the host through `:host`), `::slotted()` in light mode, `:host-context()`, and `:host` directly followed by a qualifier (`:host.x` — move the qualifier into the arguments, `:host(.x)`). So is a selector that descends past a composed child (`child-tag .x`): the scope stops at the child's tag, so the rule matches nothing. Style that content from the child's own stylesheet, or as a page-level rule in a top-level `:global { … }` block. The child's own tag and its siblings stay stylable.

{% callout .caution title="Only a real shadow root keeps page styles out" %}
The compiled scope stops the component's styles from leaking **out**. It does not stop page styles from reaching **in**: page CSS can still reach the component's internals. That is the permanent light-DOM limit — only a real shadow root provides inward encapsulation.
{% /callout %}

### Differences from a Real Shadow Root

The compiled contract behaves like the same sheet in a shadow root, except where the light-DOM emission cannot match it:

- **Page CSS can still reach the component's internals.** Only a real shadow root prevents that.
- **Page-authored children are styled by the component's rules.** This is intended where nothing is slotted.
- **Content the component's own template places inside a composed child is outside its scope.** A real shadow root would style it; the light-DOM scope stops at the child's tag. Style such content from a top-level `:global { … }` block.
- **A custom element inserted at runtime is no boundary.** The rules are live CSS, so a plain element inserted at runtime is styled like any other. But the boundary set is fixed at compile time, so a custom element added after the fact is not one — the component's rules reach its internals, in both emission forms.
- **Without native `@scope` there is no scope-proximity step.** In the lowered form, a component whose template renders a child that renders the component again loses more than native scoping would take: the outer instance's boundary guard also strips the inner instance's internals and its non-bare `:host` rules. Native `@scope`, which always uses the nearest scope, styles them.

### Switching to a Shadow Root

Shadow mode is the per-component opt-in for inward isolation, and it changes more than the wrapper:

- The same sheet emits verbatim into the shadow root's `<style>`. `::slotted()` becomes legal, and `:global` rules move to the document stylesheet — a global rule cannot live in a shadow root.
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
