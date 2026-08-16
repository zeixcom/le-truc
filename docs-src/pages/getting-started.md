---
title: 'Getting Started'
emoji: '🚀'
description: 'Installation, setup, and first steps'
---

{% hero %}
# 🚀 Getting Started

**Set up Le Truc in minutes. No build tools required.** Or use a package manager and bundler for TypeScript support and optimized frontend assets.
{% /hero %}

{% section %}
## How to Install Le Truc

Le Truc works without build tools. It also supports package managers and bundlers for projects that use TypeScript and tree-shaking.

### Use a CDN

Include Le Truc from a CDN. No build tools are required:

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

Self-hosting gives you control over updates. It avoids CDN dependencies. This helps with strict Content Security Policies.

### Install via Package Managers

If you use a bundler, install with npm or Bun:

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

Import only what you use. Le Truc is fully tree-shakeable:

```js#main.js
import { asString, bindText, defineComponent } from '@zeix/le-truc'
```

{% callout .tip title="Enabling dev-mode warnings" %}
When you bundle from source, dev mode defaults to off. All debug output is stripped. To enable enhanced warnings during development, define `process.env.DEV_MODE` as the **string** `"true"` in your bundler config. This includes alerts about unbranded parsers and API misuse. The guards check `process.env.DEV_MODE === 'true'`, so a bare boolean `true` does not enable them:

**Vite** (`vite.config.js`):
```js
define: { 'process.env.DEV_MODE': '"true"' }
```

**Bun / Rollup** (CLI flag):
```sh
--define process.env.DEV_MODE='"true"'
```

For production builds, set the value to the string `"false"`, or omit the define. The string comparison is constant-folded, so every dev-mode branch is eliminated as dead code.
{% /callout %}

{% /section %}

{% section %}

## Progressive Enhancement

Le Truc is built around **progressive enhancement**. Your HTML exists first and works without JavaScript. Le Truc layers reactivity on top when it loads.

This is the opposite of a framework that renders HTML from JavaScript. In Le Truc, the server provides the markup, including meaningful content and initial values. The component enhances the markup in place.

### The upgrade lifecycle

```
HTML is parsed → content is visible to user
JS loads → component connects → effects run
```

Between the first and last step, your page is fully usable. Le Truc reads the existing DOM values as initial state rather than replacing them.

### Wrap existing HTML

A Le Truc component is a custom element that **wraps** whatever HTML is already on the page. The children inside it are the server-rendered content. Le Truc queries them with `first()` and `all()`, then applies effects on top.

Take this HTML as a starting point:

```html
<label>
  Your name<br />
  <input name="name" type="text" autocomplete="given-name" />
</label>
<p>Hello, <output>World</output>!</p>
```

This renders a greeting and an input field. It is fully usable before any JavaScript loads. The user sees "Hello, World!" immediately. To make it reactive, you wrap it in a custom element:

```html
<basic-hello>
  <label>
    Your name<br />
    <input name="name" type="text" autocomplete="given-name" />
  </label>
  <p>Hello, <output>World</output>!</p>
</basic-hello>
```

Le Truc cannot enhance a plain `<div>` directly. Custom elements require a hyphenated name. Wrapping is low-cost: it adds one extra element and makes no structural changes to the children. If you have existing HTML inside a `<div>`, rename the element in your template, or add a custom element as a parent wrapper. The children stay exactly as they are. Le Truc gains a defined upgrade point.

{% callout .note title="Naming convention" %}
The custom element name becomes the hook for both JavaScript (`defineComponent('basic-hello', ...)`) and CSS (`basic-hello { ... }`). Keep it descriptive and specific to the component's role.
{% /callout %}

{% /section %}

{% section %}

## Create Your First Component

The `<basic-hello>` HTML above is already on the page. Now add the component definition that makes it reactive. Typing into the input updates the greeting.

Add the following inside a `<script type="module">` tag, or in an external module file:

```html#page.html
<script type="module">
  import {
    bindText,
    defineComponent,
  } from 'https://cdn.jsdelivr.net/npm/@zeix/le-truc@latest/index.js'

  defineComponent('basic-hello', ({ expose, first, on, watch }) => {
    const output = first('output', 'Needed to display the subject.')
    const fallback = output.textContent || ''

    expose({ subject: fallback })

    const input = first('input', 'Needed to enter the subject.')
    on(input, 'input', () => ({ subject: input.value || fallback }))
    watch('subject', bindText(output))
  })
</script>
```

The [Components](components.html) guide explains each piece in depth.

{% /section %}

{% section %}

## Verify Your Installation

The component works when:
- A text input and a live greeting appear
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

If it does not work:

- Check the browser console for errors (missing imports, typos).
- Ensure the `<script>` tag uses `type="module"`.
- If using npm, confirm Le Truc is installed in `node_modules/@zeix/le-truc`.

{% /section %}
