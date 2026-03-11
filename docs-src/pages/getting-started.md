---
title: 'Getting Started'
emoji: '🚀'
description: 'Installation, setup, and first steps'
---

{% hero %}
# 🚀 Getting Started

**Set up Le Truc in minutes – no build tools required**. Or use any package manager and bundler to take advantage of TypeScript support and optimize frontend assets.
{% /hero %}

{% section %}
## How to Install Le Truc

Le Truc works **without build tools** but also supports **package managers and bundlers** for larger projects. Choose the option that best fits your needs.

### Using a CDN

For the easiest setup, include Le Truc via a CDN. This is ideal for **testing or quick projects** where you want lightweight interactivity without additional tooling.

```html#page.html
<script src="https://cdn.jsdelivr.net/npm/@zeix/le-truc@latest/index.js"></script>
```

### Self-Hosting Le Truc

For production use, you may want to **self-host Le Truc** to avoid relying on a CDN. You can download the latest version from:

[index.js in Github Repository](https://github.com/zeixcom/le-truc/blob/main/index.js)

Simply host the file on your server and include it like this:

```html#page.html
<script src="/path/to/your/hosted/le-truc.js"></script>
```

**Why self-host?**

- You **control updates** and avoid breaking changes from external CDNs.
- Works for **projects with stricter Content Security Policy rules**.

Remember to keep the hosted file updated to use the latest features and bug fixes.

### Installing via Package Managers

If you're using a **bundler** like **Vite, Webpack, or Rollup**, install Le Truc via NPM or Bun:

{% tabgroup %}
#### NPM

```sh
npm install @zeix/le-truc
```

---

#### Bun

```sh
bun add @zeix/le-truc
```
{% /tabgroup %}

Then import the needed functions in your JavaScript:

```js#main.js
import { asString, defineComponent, on, setText } from '@zeix/le-truc'
```

{% /section %}

{% section %}

## Progressive Enhancement

Le Truc is built around **progressive enhancement**: your HTML exists first, works without JavaScript, and Le Truc layers reactivity on top when it loads.

This is the opposite of a framework that renders HTML from JavaScript. In Le Truc, the server provides the markup — including meaningful content and initial values — and the component enhances it in place.

### The upgrade lifecycle

```
HTML is parsed → content is visible to user
JS loads → component connects → effects run
```

Between the first and last step, your page is fully usable. Le Truc reads the existing DOM values as initial state rather than replacing them.

### Wrapping existing HTML

A Le Truc component is a custom element that **wraps** whatever HTML is already on the page. The children inside it are the server-rendered content — Le Truc queries them with `first()` and `all()` and applies effects on top.

Take this HTML as a starting point:

```html
<label>
  Your name<br />
  <input name="name" type="text" autocomplete="given-name" />
</label>
<p>Hello, <output>World</output>!</p>
```

This renders a greeting and an input field. It is fully usable before any JavaScript loads — the user sees "Hello, World!" immediately. To make it reactive, you wrap it in a custom element:

```html
<basic-hello>
  <label>
    Your name<br />
    <input name="name" type="text" autocomplete="given-name" />
  </label>
  <p>Hello, <output>World</output>!</p>
</basic-hello>
```

Le Truc cannot enhance a plain `<div>` directly — custom elements require a hyphenated name. But wrapping is low-cost: one extra element, no structural changes to the children. If you have existing HTML inside a `<div>`, either rename the element in your template or add a custom element as a parent wrapper. The children stay exactly as they are; Le Truc just has a defined upgrade point.

{% callout .tip %}
**Naming convention**: The custom element name becomes the hook for both JavaScript (`defineComponent('basic-hello', ...)`) and CSS (`basic-hello { ... }`). Keep it descriptive and specific to the component's role.
{% /callout %}

The next section shows how to define this component — and how Le Truc reads `"World"` from the `<output>` element as the initial state value when it connects.

{% /section %}

{% section %}

## Creating Your First Component

The `<basic-hello>` HTML above is already on the page. Now add the component definition that makes it reactive — typing into the input updates the greeting.

### Markup

The server-rendered HTML (from the previous section):

```html#page.html
<basic-hello>
  <label>
    Your name<br />
    <input name="name" type="text" autocomplete="given-name" />
  </label>
  <p>Hello, <output>World</output>!</p>
</basic-hello>
```

### Component Definition

Save the following inside a `<script type="module">` tag or an external JavaScript file.

```html#page.html
<script type="module">
  import {
    asString,
    defineComponent,
    on,
    setText,
  } from 'https://cdn.jsdelivr.net/npm/@zeix/le-truc@latest/index.js'

  defineComponent(
    'basic-hello',
    {
      name: asString(ui => ui.output.textContent),
    },
    ({ first }) => ({
      input: first('input', 'Needed to enter the name.'),
      output: first('output', 'Needed to display the name.'),
    }),
    ({ host, input }) => {
      const fallback = host.name
      return {
        input: on('input', () => {
          host.name = input.value || fallback
        }),
        output: setText('name'),
      }
    },
  )
</script>
```

### Understanding Your First Component

This component demonstrates Le Truc's core concepts:

- **Reactive Properties**: `name: asString(...)` creates a reactive property that syncs with the `name` attribute and falls back to the `<output>` content
- **Effects**: The setup function returns effects that handle user input and update the display text
- **Element Selection**: `first()` selects descendant element to apply effects to

Learn more about these concepts in the [Components](components.html) guide.

{% /section %}

{% section %}

## Verifying Your Installation

If everything is set up correctly, you should see:

- A text input field
- A greeting (`Hello, World!`)
- The greeting updates as you type

{% demo %}
```html
<basic-hello>
  <label>Your name<br>
    <input name="name" type="text" autocomplete="given-name">
  </label>
  <p>Hello, <output>World</output>!</p>
</basic-hello>
```
{% /demo %}

If it's not working:

- Check the browser console for errors (missing imports, typos).
- Ensure your `<script>` tag is set to `type="module"` when using ES modules.
- If using NPM, confirm Le Truc is installed inside `node_modules/@zeix/le-truc`.

{% /section %}
