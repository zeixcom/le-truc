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

Three years ago, we sat down at Zeix and looked honestly at our frontend projects. What we saw made us uncomfortable.

On one side were the legacy projects: jQuery, Bootstrap, IIFE modules, Vanilla JS. These had been perfectly reasonable choices at the time. But as features accumulated, components became entangled. Imperative wiring had quietly spread through the codebase until refactoring anything required understanding everything. The code worked, but it resisted change.

On the other side were the SPA projects: Angular, React, Vue. These had better separation of concerns — reactivity meant components stayed decoupled and updates were predictable. But there was a different kind of friction. Every two to three years, a major API overhaul. Patterns that had become second nature suddenly deprecated, replaced by something that required relearning the mental model from scratch. And components built for Vue couldn't be reused in a React project, sometimes not even across major versions of the same framework.

Neither world felt sustainable. We build for clients who need their solutions to last five to ten years. Picking any of these paths meant accepting that a future storm — a framework pivot, an end of life, a paradigm shift — could sweep away the foundation and arrive at the worst possible moment. We were building on sand.

## What we tried

We weren't looking to build a new library. We were looking for something that already existed.

Web Components were the obvious starting point. A platform-native component model, no framework lock-in, works with any backend. We were optimistic. But once we dug in, two problems became clear. First: no reactivity. Without it, we'd fall into the same trap as the jQuery era — components wired together imperatively, a tangle that grows silently until it's too expensive to unwind. Second: the mainstream implementations (Lit, Stencil) relied on client-side rendering and Shadow DOM. A moderately complex application can easily have a thousand or more components on a single page. Client-side rendering at that scale hurts performance and time to interactive in ways that matter to real users.

We looked at the lighter-weight options too. HTMX and Alpine were appealing in spirit, but controlling interactivity by scattering HTML attributes across arbitrary elements doesn't give you component boundaries, and there's no compile-time type safety to catch integration mistakes early. WebC and Enhance were interesting experiments, but they required a JavaScript layer on the backend — a non-starter when your backends are PHP, Java, C#, or Python — and they didn't offer client-side reactivity anyway.

Meanwhile, SPA frameworks were pivoting to server-side rendering. When we finally worked through how React Server Components actually function, we understood the reasoning. But the solution felt like an ever more elaborate architecture to paper over a problem that had been introduced by the architecture itself.

## The root cause

That last observation forced a more fundamental question: where does the problem actually come from?

When we built sites with PHP and jQuery, we didn't have a double-data or double-template problem. The server rendered HTML correctly. The browser displayed it. JavaScript added interactivity where needed. That was it. The web platform did its job.

The double-data problem — sending both a rendered HTML fragment and the JSON data required to re-render it — is not a property of web development in general. It's a consequence of a specific architectural choice: entangling client-side rendering with data flow. Once a framework takes over rendering on the client, it owns the component lifecycle, and now it needs to be able to re-render from scratch. JSON data and JS templates must travel to the browser. SSR becomes a workaround to get HTML on the initial load, while the framework re-takes control during hydration.

Vanilla JS doesn't have this problem. PHP didn't have this problem. The problem was introduced by SPA frameworks, and their proposed solutions — Server Components, islands, partial hydration — are attempts to claw back what was given up.

We refused to accept the limitation as given. We went back to first principles.

## The approach

The insight was simple, even if the implementation wasn't: separate rendering from data flow entirely. Let the server render HTML — correctly, once, with full access to your data, in whatever backend language your team uses. Let the browser display that HTML immediately. Then, and only then, let JavaScript wire up interactivity.

This is what Le Truc does. It never re-renders. When a property changes, only the exact DOM nodes that depend on that property are touched — a text node gets new content, a class gets toggled, an attribute gets updated. The rest of the page is untouched.

For components, we use the Web Components standard. Custom elements are genuinely portable: they work across frameworks and across projects, and they're defined by a W3C specification with long-term browser support. We add a thin reactive layer — a signal graph — that gives components the same kind of decoupled, predictable updates that drew us to SPA frameworks in the first place, without the rendering overhead and without the lock-in.

## From CodePen to 1.0

We started in early 2024 with a proof of concept in CodePen — a few hundred lines of JavaScript, no build tools, just enough to verify that the approach was feasible. The early version was clever. It used signals and worked — as long as developers handled errors externally and were comfortable with implicit type coercion.

Clever turned out to be the wrong property to optimize for. We spent the following year making Le Truc less clever and more robust. Type safety became a central concern. The DOM is an external world: unlike a framework that controls the full component lifecycle, we had to infer types from selector strings, attribute values, and element queries that could return anything. Getting compile-time type inference to work — so that `first('button')` returns `HTMLButtonElement` and `first('input[type="text"]')` returns `HTMLInputElement` — required building a type-level CSS selector parser in TypeScript. It was not on the original roadmap. It turned out to be worth it.

We also separated the reactive primitives into their own library, `@zeix/cause-effect`, for a reason that still matters: if the TC39 signals proposal matures, or a faster signals implementation appears, we can swap the foundation without rewriting Le Truc.

One mechanism we're particularly proud of: `pass()`. In most component models, sharing state between parent and child means prop drilling — passing values through a chain of components, each re-rendering on change. In Le Truc, when a parent passes a signal to a child Le Truc component, they share the same underlying signal node. There's no intermediate effect, no copying of values, no chain of renders. The child always has direct access to the current value, one hop away. The coordinating parent can be application-specific; the receiving component stays generic, with no knowledge of where its reactive value comes from.

## What it looks like

Here is a counter component:

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

Four arguments: a name, reactive properties with their parsers, a DOM query function, and a setup function that returns an effects map. The component connects to the server-rendered HTML, reads the initial count from the DOM, and updates only the `output` element when the count changes. No virtual DOM. No re-render. No JSON payload.

If that sounds like something you've been looking for — or if you've been frustrated by the same trade-offs we were — we'd love for you to try it.

Read the [Getting Started](/getting-started.md) guide, or browse the [API reference](/api.md). The library is MIT-licensed, open-source, and less than 10 kB gzipped.
{% /section %}
