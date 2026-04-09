---
title: 'Styling'
emoji: '🎨'
description: 'Scoped styles, CSS custom properties'
---

{% hero %}
# 🎨 Styling

**Keep your components' styles self-contained while supporting shared design tokens.** Le Truc offers a refreshingly simple approach to create reactive Web Components that enhance your existing HTML.
{% /hero %}

{% section %}
## Design Principles

Le Truc handles state management and reactivity — CSS handles everything visual. The key principles: **scope styles to the component**, **expose customization via CSS custom properties**, and **avoid reaching inside sub-components**. A parent may style the wrapper element of a known sub-component for layout, but styling its inner elements creates tight coupling.

{% /section %}

{% section %}
## Scope Styles to Custom Element

Use the **custom element name** to scope component styles if **you control the page and the components within**. This protects against component styles leaking out, while still allowing to use the CSS cascade. No need for Shadow DOM, no duplicate style rules.

```css
my-component {
  & button {
    /* Button style rules */
  }

  /* More selectors for inner elements */
}
```

### Advantages of Custom Element Names

- By definition **unique within the document** with a descriptive name.
- **Low specificity**, making it easy to override when you need to with a single class.

{% callout .tip %}
**When to use**

**Best when** you control the page and need styles to cascade naturally.
**Avoid if** you expect style clashes from third-party styles.
{% /callout %}

{% /section %}

{% section %}
## Encapsulate Styles with Shadow DOM

Use **Shadow DOM** to encapsulate styles if your component is going to be used in a pages **where you don't control the styles**. This way you make sure page styles don't leak in and component styles don't leak out.

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

{% callout .tip %}
**When to use**

**Best when** your component is used in environments where you don’t control styles.
**Avoid if** you need global styles to apply inside the component.
{% /callout %}

{% /section %}

{% section %}
## Shared Design Tokens with CSS Custom Properties

Web Components can't inherit global styles inside **Shadow DOM**, but CSS custom properties allow components to remain **flexible and themeable**.

### Defining Design Tokens

Set global tokens in a stylesheet:

```css
:root {
  --button-bg: #007bff;
  --button-text: #fff;
  --spacing: 1rem;
}
```

### Using Tokens in a Component

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

Use **classes** if your components can appear in a **limited set of specific manifestations**. For example, buttons could come in certain sizes and have primary, secondary and tertiary variants.

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

CSS class variants become interactive when JavaScript toggles them in response to state. The contract is simple: **the class name in CSS must exactly match the token passed to `bindClass()`**.

The `module-scrollarea` component demonstrates this clearly. The CSS defines what the shadow looks like when overflow is present:

```css
module-scrollarea {
  &::after {
    opacity: 0;
    transition: opacity var(--transition-short);
    /* gradient shadow rendered here */
  }

  &.overflow-end::after {
    opacity: 1; /* fades in when JS adds the class */
  }
}
```

The component's factory creates a local signal and passes it to `watch()` + `bindClass()`:

```js
const overflowEnd = createState(false)

return [
  watch(overflowEnd, bindClass(host, 'overflow-end')),
]
```

When `overflowEnd` becomes `true`, Le Truc adds `overflow-end` to the host element. The CSS rule activates, and the shadow fades in. When it becomes `false`, the class is removed and the shadow fades out — no inline styles, no manual DOM manipulation.

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
return [
  watch('selected', () => {
    for (const tab of tabs.get()) {
      tab.setAttribute('aria-selected',
        String(host.selected === tab.getAttribute('aria-controls')))
    }
  }),
]
```

Prefer attributes over classes when the value has semantic meaning — screen readers and assistive technology understand `aria-selected`, `aria-expanded`, `disabled`, and similar attributes.

The full example is a tab group that uses `aria-selected` to highlight the selected tab: [Tabgroup example](./examples/module-tabgroup.html).

{% /section %}

{% section %}
## CSS-only Components

Just because Le Truc is a JavaScript library doesn't mean you have to use JavaScript in every component. It's perfectly fine to use custom elements just for styling purposes.

Here's the example of the `<card-callout>` we're using in this documentation:

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

If a Le Truc component queries for a CSS-only custom element (via `first()` or `all()`), it will detect the element as an unresolved dependency and wait for it to upgrade — causing an unnecessary delay before effects run.

To avoid this, register CSS-only custom elements with a trivial definition:

```js
customElements.define('card-callout', class extends HTMLElement {})
```

This tells the browser (and Le Truc) that the element is defined and ready. The registration has no runtime cost — the element simply upgrades to a plain `HTMLElement` immediately.

{% callout .tip %}
**As a rule of thumb**, every custom element tag you use in HTML should have a corresponding `customElements.define()` call. This is the web platform's contract: a hyphenated tag name is a custom element, and defining it — even with an empty class — ensures it upgrades correctly and doesn't block other components.
{% /callout %}

{% /section %}
