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

Every useful abstraction layer over the web platform has eventually become technical debt. Not because the abstraction was wrong – often it was brilliant – but because the platform caught up. jQuery shaped the DOM API. Sass shaped native CSS. Lodash and Moment.js shaped modern JS APIs. The pattern is consistent enough to treat it as a law: a successful abstraction teaches the platform what to absorb next.

We're not saying frameworks will disappear. We're saying what they fill today will shrink. And that matters if you're building with a ten-year horizon.

## What we learned from React

React changed how we build for the web. Components, reactivity, TypeScript-first design – we want all of that, and Le Truc keeps all of it.

The one place we deliberately depart from React is the virtual DOM. Every update cycle means reconciling a virtual model against the real one. That has a runtime cost, but the bigger issue is the failure modes it creates: stale closures, hydration mismatches, tearing, `useEffect` timing bugs. Those aren't implementation quirks. They're structural – the inevitable result of maintaining two parallel models of your UI simultaneously.

## What we chose not to do

We looked at the alternatives seriously. A compiler-based approach – like Svelte or Solid – genuinely hits the sweet spot if you want co-location of HTML, CSS, and JavaScript with fine-grained reactivity and full type-safety. The tradeoff is a proprietary file format, a compiler you depend on, server-side TypeScript, and an initial render/hydration step that sends data and templates twice over the wire.

We looked at custom languages too – Elm, Marko – each technically impressive, each ultimately constrained by tooling and portability. Leaving the JavaScript ecosystem buys elegance at a cost we weren't willing to pay.

So we made a different set of tradeoffs. Le Truc abandons co-location – HTML and behaviour live in separate files – but keeps components, fine-grained reactivity, and first-class TypeScript. More importantly, it stays entirely within the bounds of the client-side web platform. There is no virtual DOM. There is no reconciliation step. There is one model of your UI: the DOM. Your server renders it. Your signals update it.

## What you get for free

Betting on the platform is not just a philosophical position. It pays out in three concrete ways.

1. **An entire class of bugs simply does not exist.** Hydration mismatches, stale closure bugs, useEffect ordering issues, tearing – all of these are symptoms of maintaining an abstraction layer that can diverge from the platform. When your rendering model is the platform, there is nothing to diverge. Your browser's inspector is the only dev tooling you need. What you see in the elements panel is exactly what your code produces, with no intermediate representation to reason about.

2. **Performance that unlocks genuinely different use cases.** Skipping the re-render and re-check cycle is not just a benchmark win. It is the difference between being able to build a live trading terminal, a collaborative vector editor, a MIDI sequencer, or a data grid with real formula dependency tracking. Dropping out of the component model entirely into canvas or WebGL is one way around that – but it's not always what you want. Le Truc lets you stay in the type-safe, reactive, component-based abstraction at frame-rate scale. That combination does not otherwise exist.

3. **Long-term stability that compounds.** React's future is controlled by Meta. The web platform's future is controlled by a standards body with broad industry representation. Those are different risk profiles. The web platform has also demonstrated, consistently, that it absorbs the ideas from successful abstractions – which means Le Truc can become thinner as the platform grows. What we add today, the platform absorbs over time.

- jQuery → `querySelector`, `fetch`, `classList`
- Sass → custom properties, nesting, `@layer`, `@scope`
- Lodash → `Array.flat`, `Object.entries`, optional chaining
- Moment.js → `Intl.DateTimeFormat`, upcoming `Temporal`
- Bootstrap → `<dialog>`, popover, anchor positioning
- React → Web Components, proposed `Signal`

We're not betting against React. We're betting on where the platform is going – building something that gets cheaper to own the further it goes.
{% /section %}
