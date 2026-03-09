---
title: Introducing Le Truc
description: A reactive custom elements library that brings fine-grained reactivity directly to the web platform — no virtual DOM, no framework overhead.
emoji: 🎉
layout: blog
date: 2026-03-09
author: Esther Brunner
tags: release, announcement
---

{% section%}
## Why Le Truc?

Most JavaScript frameworks come with significant trade-offs: a large runtime, a proprietary component model, or a steep learning curve. Le Truc takes a different approach — it enhances the native custom elements API with a minimal reactive layer, keeping your components close to the web platform.

## Core Ideas

**Signals drive the DOM.** Every property on a Le Truc component is a reactive signal. When a signal changes, only the DOM nodes that depend on it update — no diffing, no re-renders.

**Parsers connect attributes to state.** The `asString()`, `asInteger()`, `asBoolean()` parsers read HTML attributes and feed them into signals. Attribute changes automatically flow through to the DOM.

**Effects are composable.** `setAttribute`, `setText`, `toggleClass`, `on` — each effect is a small focused function. Compose them in a `setup` function and Le Truc wires up the reactivity for you.
{% /section %}

{% section %}
## Getting Started

```ts
import { defineComponent, asInteger, on, setText } from '@zeix/le-truc'

defineComponent(
  'basic-counter',
  { count: asInteger(0) },
  ({ first }) => ({ button: first('button'), output: first('output') }),
  ({ host }) => ({
    button: on('click', () => { host.count++ }),
    output: setText('count'),
  }),
)
```

Read the [Getting Started](/getting-started) guide for a full walkthrough.
{% /section %}
