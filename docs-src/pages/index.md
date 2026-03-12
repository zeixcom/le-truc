---
title: 'Introduction'
emoji: '📖'
description: 'Overview and key benefits of Le Truc'
---

{% hero %}

# 📖 Introduction

**Web development doesn't need to be complicated**. Le Truc lets you create reactive Web Components that enhance your existing HTML.
{% /hero %}

{% section .breakout %}

## What is Le Truc?

{% carousel %}

{% slide title="We Can Have Nice Things!" class="purple" %}
- Embrace the Web Platform
- Use any server-side technology to render HTML
- Have components
- Have reactivity
- Have type-safety
- Have optimal performance
- Have fun!
{% /slide %}

{% slide title="HTML First." class="pink" %}
Le Truc assumes you start with semantic HTML and want to enhance it with behavior:

```html
<hello-world>
  <p>Hello, <span>Alice</span>!</p>
</hello-world>
```

This means better SEO, faster initial page loads, and progressive enhancement that works even when JavaScript fails.
{% /slide %}

{% slide title="Add JavaScript." class="orange" %}
Progressively enhance the user experience by adding interactivity:

```js
import { asString, defineComponent, setText } from '@zeix/le-truc'

defineComponent(
  'hello-world',
  { name: asString() },
  q => ({ span: q.first('span') }),
  () => ({ span: setText('name') }),
)
```

Le Truc augments what the platform already provides. It leverages the Web Components standard while adding just enough convenience functions to make reactive UI behaviors easy to implement.
{% /slide %}

{% slide title="Faster. Because We Do Less." class="green" %}
- Unlike SPA frameworks (React, Vue, Angular, Svelte, Lit, etc.) we **never render** on the client. Instead, the server and browser do this work. Like it's 1995.
- Because we never render on the client, we need no JSON data and no JS templates either. This means less data over the wire and no plumbing DB → JSON → JS → HTML.
- Unlike Hypermedia frameworks (HTMX, Datastar) we don't compensate for the lack of client-side rendering by a network request if not needed. If possible, we calculate the new state on the client.
- We just add event listeners and set up a signal graph. Invisible work that doesn't cause layout shifts.
- When the user interacts with the UI, we know exactly what to do. We just do fine-grained updates to the DOM. No VDOM, no diffing. Wait for signal 🚦 and go! 🏁
{% /slide %}

{% slide title="Minimal Size." class="blue" %}
Because we add fewer abstractions, we can keep the library small (approximately 10kB gzipped).

HTML ain't broken. CSS ain't broken. JavaScript ain't broken. We just want to split it in chunks (components), detect bugs early (type safety), and have predictable updates without tight coupling (reactivity). That's what we stand for.
{% /slide %}

{% /carousel %}

{% /section %}
