---
title: Betting on the Platform
description: Why we built Le Truc around the browser's native rendering instead of replacing it – and why that bet gets stronger every year.
emoji: 🎲
layout: blog
date: 2026-04-15
author: Esther Brunner
tags: web platform, frontend architecture
---

{% section %}
## The abstraction tax

Every useful abstraction layer over the web platform eventually becomes technical debt. Not because it was wrong – often it was brilliant – but because the platform caught up. jQuery shaped the DOM API. Sass shaped native CSS. Lodash and Moment.js shaped modern JS APIs. The pattern is consistent: a successful abstraction teaches the platform what to absorb next.

We're not saying frameworks will disappear. We're saying what they fill today will shrink. And that matters if you're building with a ten-year horizon.

## What we learned from React

React changed how we build for the web. Components, reactivity, TypeScript-first design – we want all of that, and Le Truc keeps all of it.

The one place we deliberately depart from React is the virtual DOM. Every update cycle means reconciling a virtual model against the real one. That has a runtime cost, but the bigger issue is the failure modes it creates: stale closures, hydration mismatches, tearing, `useEffect` timing bugs. Those aren't implementation quirks. They're structural – the inevitable result of maintaining two parallel models of your UI simultaneously.

## What we chose not to do

We looked at the alternatives. A compiler-based approach – like Svelte or Solid – hits the sweet spot. It gives you co-location of HTML, CSS, and JavaScript with fine-grained reactivity and full type-safety. The tradeoff is a proprietary file format, a compiler you depend on, server-side TypeScript, and an initial render/hydration step that sends data and templates twice over the wire.

We looked at custom languages too – Elm, Marko – each technically impressive, each ultimately constrained by tooling and portability. Leaving the JavaScript ecosystem buys elegance at a cost we weren't willing to pay.

So we made a different set of tradeoffs. Le Truc abandons co-location – HTML and behaviour live in separate files – but keeps components, fine-grained reactivity, and first-class TypeScript. More importantly, it stays entirely within the bounds of the client-side web platform. There is no virtual DOM or reconciliation step. There is one model of your UI: the DOM. Your server renders it, and your signals update it.

## What you get for free

Betting on the platform pays out in three concrete ways.

1. **An entire class of bugs doesn't exist.** Hydration mismatches, stale closure bugs, `useEffect` ordering issues, tearing – all of these are symptoms of maintaining an abstraction layer that can diverge from the platform. When your rendering model is the platform, there is nothing to diverge. Your browser's inspector is the only dev tooling you need. What you see in the elements panel is exactly what your code produces, with no intermediate representation to reason about.

2. **Performance that unlocks different use cases.** Skipping the re-render and re-check cycle isn't just a benchmark win. It's the difference between building a [live trading terminal](../examples.html#module-ticker), a collaborative vector editor, a MIDI sequencer, or a data grid with real formula dependency tracking. Dropping into canvas or WebGL is one workaround – but it's not always what you want. Le Truc lets you stay in a type-safe, reactive, component-based abstraction at frame-rate scale. That combination doesn't otherwise exist.

3. **Long-term stability that compounds.** React's future is controlled by Meta. The web platform's future is controlled by a standards body with broad industry representation. Those are different risk profiles. The web platform consistently absorbs ideas from successful abstractions. This means Le Truc can become thinner as the platform grows. What we add today, the platform absorbs over time.

- jQuery → `querySelector`, `fetch`, `classList`
- Sass → custom properties, nesting, `@layer`, `@scope`
- Lodash → `Array.flat`, `Object.entries`, optional chaining
- Moment.js → `Intl.DateTimeFormat`, upcoming `Temporal`
- Bootstrap → `<dialog>`, `popover`, anchor positioning
- React → Web Components, proposed `Signal`

We're not betting against React. We're betting on where the platform is going – building something that gets cheaper to own the further it goes.
{% /section %}
