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

{% callout .note title="Authoring in .tsrx" %}
A `.tsrx` component's `<style>` block is emitted verbatim, unscoped — the same tag-name convention above applies, just written once and compiled through unchanged. See `TSRX-HOST-PROFILE.md` in the repo root.
{% /callout %}

{% /section %}

{% section %}
## Encapsulate Styles with Shadow DOM

Use **Shadow DOM** to encapsulate styles when you do not control the page styles where the component appears. Page styles do not leak in. Component styles do not leak out.

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
