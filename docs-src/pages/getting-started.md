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

Le Truc works without build tools but also supports package managers and bundlers for projects that benefit from TypeScript and tree-shaking.

### Using a CDN

Include Le Truc from a CDN — no build tools needed:

```html#page.html
<script src="https://cdn.jsdelivr.net/npm/@zeix/le-truc@latest/index.js"></script>
```

### Self-Hosting Le Truc

To avoid a CDN dependency, download `index.js` from the repository and host it yourself:

[index.js in GitHub Repository](https://github.com/zeixcom/le-truc/blob/main/index.js)

Then include it like any other script:

```html#page.html
<script src="/path/to/your/hosted/le-truc.js"></script>
```

Self-hosting gives you control over updates and avoids CDN dependencies — useful for stricter Content Security Policies.

### Installing via Package Managers

If you're using a bundler, install via npm or Bun:

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

Import only what you use — Le Truc is fully tree-shakeable:

```js#main.js
import { asString, bindText, defineComponent } from '@zeix/le-truc'
```

{% callout .tip title="Enabling dev-mode warnings" %}
When bundling from source, `DEV_MODE` defaults to `false` and all debug output is stripped. To enable enhanced warnings during development — including alerts about unbranded parsers and API misuse — define `process.env.DEV_MODE` in your bundler config:

**Vite** (`vite.config.js`):
```js
define: { 'process.env.DEV_MODE': 'true' }
```

**Bun / Rollup** (CLI flag):
```sh
--define process.env.DEV_MODE=true
```

Set the value to `false` (or omit it) for production builds to ensure dead code is eliminated.
{% /callout %}

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

{% callout .tip title="Naming convention" %}
The custom element name becomes the hook for both JavaScript (`defineComponent('basic-hello', ...)`) and CSS (`basic-hello { ... }`). Keep it descriptive and specific to the component's role.
{% /callout %}

{% /section %}

{% section %}

## Creating Your First Component

The `<basic-hello>` HTML above is already on the page. Now add the component definition that makes it reactive — typing into the input updates the greeting.

Add the following inside a `<script type="module">` tag, or in an external module file:

```html#page.html
<script type="module">
  import {
    bindText,
    defineComponent,
  } from 'https://cdn.jsdelivr.net/npm/@zeix/le-truc@latest/index.js'

  defineComponent('basic-hello', ({ expose, first, on, watch }) => {
    const input = first('input', 'Needed to enter the name.')
    const output = first('output', 'Needed to display the name.')
    const fallback = output.textContent || ''

    expose({ name: output.textContent ?? '' })

    return [
      on(input, 'input', () => ({ name: input.value || fallback })),
      watch('name', bindText(output)),
    ]
  })
</script>
```

The [Components](components.html) guide explains each piece in depth.

{% /section %}

{% section %}

## Verifying Your Installation

The component is working when a text input and a live greeting appear, and the greeting updates as you type:

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

If it doesn't work:

- Check the browser console for errors (missing imports, typos).
- Ensure the `<script>` tag uses `type="module"`.
- If using npm, confirm Le Truc is installed in `node_modules/@zeix/le-truc`.

{% /section %}
