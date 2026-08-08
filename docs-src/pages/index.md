---
title: 'Introduction'
emoji: '📖'
description: 'Overview and key benefits of Le Truc'
---

{% hero %}

# 📖 Introduction

**Le Truc adds a reactive layer to server-rendered HTML.** Keep your existing backend. Le Truc wires type-safe component properties directly to DOM updates in the browser. It needs no re-rendering step and no JavaScript server.
{% /hero %}

{% section .breakout %}

## What is Le Truc?

{% carousel %}

{% slide title="We Can Have Nice Things!" class="purple" %}
- Embrace the Web Platform
- Use any server-side technology to render HTML
- Type-safe reactive components
- Fine-grained DOM updates — no VDOM, no diffing
- Core under 9 kB gzipped, tree-shakeable extensions
{% /slide %}

{% slide title="HTML First." class="pink" %}
Le Truc assumes you start with semantic HTML. You add behavior on top:

```html
<hello-world>
  <p>Hello, <span>Alice</span>!</p>
</hello-world>
```

This approach gives you:
- Better SEO
- Faster initial page loads
- Progressive enhancement — the page still works when JavaScript fails
{% /slide %}

{% slide title="Add JavaScript." class="orange" %}
Add JavaScript to progressively enhance the user experience:

```js
import { bindText, defineComponent } from '@zeix/le-truc'

defineComponent('hello-world', ({ expose, first, watch }) => {
  const span = first('span')
  expose({ name: span.textContent ?? '' })
  watch('name', bindText(span))
})
```

The component is a native Custom Element. Its `name` property is reactive. Reading it inside an effect tracks the dependency. Writing it triggers only the affected DOM update.
{% /slide %}

{% slide title="Faster. Because We Do Less." class="green" %}
- SPA frameworks (React, Vue, Angular, Svelte, Lit, etc.) render on the client. Le Truc **never does**. The server renders HTML, and the browser shows it immediately. There is no hydration, no double templates, and no pipeline from database to JSON to JavaScript to HTML.
- Hypermedia frameworks (HTMX, Datastar) avoid client rendering. They fetch new HTML from the server on every state change. Le Truc updates state locally. It sends a network request only when the logic needs data from the server.
- Le Truc sets up event listeners and a signal graph. It causes no layout shifts and uses no virtual DOM or diffing. When state changes, only the affected DOM nodes update.
{% /slide %}

{% slide title="Minimal Size." class="blue" %}
Le Truc adds few abstractions, so the library stays small. The core is under 8 kB gzipped. Extensions are fully tree-shakeable.

HTML, CSS, and JavaScript already solve most of the problem. Le Truc adds what is missing: component boundaries, compile-time type safety, and predictable reactive updates without tight coupling.
{% /slide %}

{% /carousel %}

{% /section %}
