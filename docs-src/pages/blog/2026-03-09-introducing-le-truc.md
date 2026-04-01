---
title: Introducing Le Truc
description: We built Le Truc after years of jQuery legacy code and SPA framework churn. Here is the story of why, what we tried, and what we learned along the way.
emoji: 🎉
layout: blog
date: 2026-03-09
author: Esther Brunner
tags: release, announcement
---

{% section %}
## Building on sand

Three years ago, we sat down at Zeix and took a hard look at our frontend projects. What we saw made us uncomfortable.

On one side were the legacy projects: jQuery, Bootstrap, IIFE modules, Vanilla JS. All reasonable choices at the time. But as features piled up, components grew tangled. DOM updates were wired together by hand, and that wiring had quietly spread through the codebase until changing anything meant understanding everything. The code worked, but it fought back every time you tried to touch it.

On the other side were the SPA projects: Angular, React, Vue. Better in some ways — reactivity kept components decoupled and updates predictable. But there was a different problem. Every two to three years, a major overhaul. Patterns you knew cold were deprecated, replaced by something that required rebuilding your mental model from scratch. And components built for Vue could not be reused in a React project, sometimes not even across major versions of the same framework.

Neither felt like a foundation you could build on for the long term. We work with clients who need their software to last five to ten years. Any of these paths meant accepting that a future shift — a framework pivot, an end of life, a fundamental change in direction — could pull the rug out from under you at the worst possible moment. We were building on sand.

## What we tried

We were not trying to build a new library. We were looking for something that already existed.

Web Components were the obvious starting point. A component model built into the browser, no framework dependency, works with any backend. We were hopeful. But once we dug in, two problems showed up. First: no reactivity. Without it, we would fall back into the same trap as the jQuery era — components wired together imperatively, a mess that grows silently until it is too expensive to clean up. Second: the mainstream implementations (Lit, Stencil) relied on client-side rendering and Shadow DOM. A moderately complex page can easily have hundreds or thousands of components. Rendering all of those on the client hurts performance and load time in ways that real users notice.

We looked at lighter-weight options too. HTMX and Alpine were appealing in spirit, but controlling interactivity by scattering HTML attributes across arbitrary elements gives you no component boundaries, and there is no type safety to catch integration mistakes before they reach the browser. WebC and Enhance were interesting experiments, but they required a JavaScript layer on the server — a deal-breaker when your backends are PHP, Java, C#, or Python — and they did not offer client-side reactivity anyway.

Meanwhile, SPA frameworks were moving toward server-side rendering. When we worked through how React Server Components actually function, we understood the reasoning. But it felt like an increasingly complicated architecture built to patch a problem that the architecture itself had introduced.

## The root cause

That last observation pushed us toward a more fundamental question: where does the problem actually come from?

When we built sites with PHP and jQuery, there was no double-data problem. The server rendered HTML. The browser showed it. JavaScript added interactivity where needed. That was it.

The double-data problem — sending both an HTML fragment and the JSON data needed to re-render it — is not something inherent to web development. It is a consequence of a specific choice: letting the framework own rendering on the client. Once a framework does that, it also owns the component lifecycle, which means it needs to be able to re-render from scratch at any point. JSON and JavaScript templates have to travel to the browser. SSR becomes a workaround to get HTML on the first load while the framework takes back control during hydration.

Vanilla JS never had this problem. PHP never had this problem. SPA frameworks introduced it, and their solutions — Server Components, islands, partial hydration — are attempts to recover what was given up.

We did not want to accept that as the starting point. We went back to basics.

## The approach

The core idea was simple, even if building it was not: keep rendering and data flow separate. Let the server render HTML — once, correctly, with full access to your data, in whatever backend language you use. Let the browser show that HTML straight away. Then, and only then, let JavaScript wire up the interactive parts.

That is what Le Truc does. It never re-renders. When a property changes, only the exact DOM nodes that depend on that property are updated — a text node gets new content, a class gets toggled, an attribute changes. Everything else is left alone.

For components, we use the Web Components standard. Custom elements work across frameworks and projects, backed by a W3C specification with long-term browser support. We add a thin reactive layer — a signal graph — that gives components the same decoupled, predictable updates that made SPA frameworks attractive in the first place, without the rendering overhead and without the lock-in.

## From CodePen to 1.0

We started in early 2024 with a proof of concept in CodePen — a few hundred lines of JavaScript, no build tools, just enough to check that the approach could work. The early version was clever. It used signals and it worked — as long as developers handled errors themselves and were okay with implicit type coercion.

Clever turned out to be the wrong thing to aim for. We spent the following year making Le Truc less clever and more solid. Type safety became central. The DOM is an outside world: unlike a framework that controls the full component lifecycle, we had to infer types from selector strings, attribute values, and element queries that could return anything. Getting compile-time type inference to work — so that `first('button')` returns `HTMLButtonElement` and `first('input[type="text"]')` returns `HTMLInputElement` — meant building a type-level CSS selector parser in TypeScript. That was not on the original roadmap. It turned out to be worth it.

We also split the reactive primitives into their own library, `@zeix/cause-effect`, for a reason that still matters: if the TC39 signals proposal matures, or a faster signals implementation comes along, we can swap the foundation without rewriting Le Truc.

One mechanism we are particularly proud of: `pass()`. In most component models, sharing state between parent and child means prop drilling — passing values down a chain of components, each re-rendering when something changes. In Le Truc, when a parent passes a signal to a child Le Truc component, they share the same underlying signal node directly. No intermediate effect, no copying values, no chain of renders. The child always has direct access to the current value, one hop away. The parent can be specific to your application; the child stays generic, with no knowledge of where its reactive value comes from.

## What it looks like

Here is a counter component:

```ts
import { defineComponent, asInteger, on, setText } from '@zeix/le-truc'

defineComponent(
  'basic-counter',
  { count: asInteger(0) },
  ({ first }) => ({
    button: first('button'),
    output: first('output'),
  }),
  ({ host }) => ({
    button: on('click', () => { host.count++ }),
    output: setText('count'),
  }),
)
```

Four arguments: a name, reactive properties with their parsers, a DOM query function, and a setup function that returns an effects map. The component connects to the server-rendered HTML, reads the initial count from the DOM, and updates only the `output` element when the count changes. No virtual DOM. No re-render. No JSON payload.

If that sounds like something you have been looking for — or if you have been frustrated by the same trade-offs we were — we would love for you to try it.

Read the [Getting Started](/getting-started.md) guide, or browse the [API reference](/api.md). The library is MIT-licensed, open-source, and less than 10 kB gzipped.
{% /section %}
