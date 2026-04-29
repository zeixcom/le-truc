---
title: "Introduction"
description: "Overview and key benefits of Le Truc"
emoji: "📖"
---

# 📖 Introduction

**Le Truc adds a reactive layer to server-rendered HTML.** Keep your existing backend. Le Truc wires type-safe component properties to fine-grained DOM updates in the browser, without re-rendering and without a JavaScript server.

## What is Le Truc?

- Embrace the Web Platform
- Use any server-side technology to render HTML
- Type-safe reactive components
- Fine-grained DOM updates — no VDOM, no diffing
- Under 10 kB gzipped, tree-shakeable

Le Truc assumes you start with semantic HTML and want to enhance it with behavior:

```html
<hello-world>
  <p>Hello, <span>Alice</span>!</p>
</hello-world>
```

This means better SEO, faster initial page loads, and progressive enhancement that works even when JavaScript fails.

Progressively enhance the user experience by adding interactivity:

```js
import { bindText, defineComponent } from '@zeix/le-truc'

defineComponent('hello-world', ({ expose, first, watch }) => {
  const span = first('span')
  expose({ name: span.textContent ?? '' })
  return [watch('name', bindText(span))]
})
```

The component is a native Custom Element. Its `name` property is reactive — reading it inside an effect tracks the dependency; writing it triggers only the affected DOM update.

- SPA frameworks (React, Vue, Angular, Svelte, Lit, etc.) render on the client. Le Truc **never does**. The server renders HTML; the browser shows it immediately — no hydration, no double templates, no DB → JSON → JS → HTML pipeline.
- Hypermedia frameworks (HTMX, Datastar) avoid client rendering but fetch new HTML from the server on every state change. Le Truc updates state locally — a network request only when your logic actually needs server data.
- Le Truc sets up event listeners and a signal graph. No layout shifts, no VDOM, no diffing. When state changes, only the affected DOM nodes update.

Because we add fewer abstractions, we can keep the library small (under 10 kB gzipped, tree-shakeable).

HTML, CSS, and JavaScript already solve most of the problem. Le Truc adds what's missing: component boundaries, compile-time type safety, and predictable reactive updates without tight coupling.
