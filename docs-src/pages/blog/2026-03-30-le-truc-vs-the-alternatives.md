---
title: Le Truc vs the Alternatives
description: SPA frameworks, Hypermedia frameworks, and Web Component libraries each solve a real problem. Here is what separates them — and where Le Truc fits in.
emoji: ⚖️
layout: blog
date: 2026-03-30
author: Esther Brunner
tags: architecture, comparison
---

{% section %}
Different families of web tools exist because they solve different problems. Pick the wrong one and you are fighting the tool instead of building your product. This post goes through the main families, what each is good at, and where Le Truc fits — not to argue it is the best for everything, but to help you decide if it is right for you.

## SPA frameworks: when the client owns the UI

React, Vue, Angular, and Svelte all make the same fundamental choice: the framework is responsible for rendering. You **describe what the UI should look like** given some state, and the framework updates the DOM to match. Virtual DOM diffing, compiled templates, fine-grained reactivity — these are different ways to get there, but the goal is the same.

This solves a real problem. When the UI is genuinely complex — dashboards updating in real time, drag-and-drop, forms where dozens of fields affect each other — hand-writing DOM updates gets messy fast. Describing UI as a function of state is much cleaner. You stop thinking about "change this element" and start thinking about "this is what the screen looks like now." For the right kind of app, that is a big deal.

The catch is that the framework renders your HTML, so the browser has nothing to show until the JavaScript bundle has downloaded, parsed, and run. Server-side rendering (SSR) solves this, and it works — React Server Components, Nuxt, SvelteKit all do it well. But SSR in an SPA framework is not simple. It adds a whole layer: the server renders the initial HTML, then the client re-runs the framework to take back control. That means the same data has to flow both as HTML (for the initial render) and as JSON (so the client can hydrate). If your backend is PHP, Java, or Python, you now have a JavaScript server in the middle as a bridge. That is a real cost you are taking on.

None of this means SPA frameworks are wrong. If you are building something new where you control the whole stack, the UI is genuinely application-like, and you plan to invest in this for years — they are a great fit. The question is whether your project actually looks like that.

## Lit and the component library story

Lit fills a specific gap: it is built for **building component libraries** — reusable UI pieces that work in any frontend, whether that is React, Vue, or plain HTML. A button, a dialog, a data table — packaged once, used anywhere.

Shadow DOM is central to how it does this. It draws a hard boundary around a component's internals: outside styles cannot reach in, and outside code cannot poke at the internal structure. For a component library, that is exactly what you want. The author controls the component's appearance, and users cannot accidentally break it by targeting elements too deep inside.

That same boundary, though, is why Lit is awkward outside the component library context. When components belong to the same site and need to share state, styles, or events, the hard boundary becomes a wall you have to work around. And while SSR is technically possible, the component still re-renders its own structure on the client anyway, which defeats much of the point.

If you are building a design system to distribute as a package that works across different frameworks: Lit is probably the right tool.

## HTMX and Datastar: the Hypermedia comeback

HTMX and Datastar take a different angle — one that seemed almost odd when they first appeared. Instead of shifting rendering to the client, they keep it on the server and give HTML the ability to **trigger requests and update parts of the page** without a full reload. Click a button, the browser sends a request, the server returns an HTML fragment, and that fragment replaces a piece of the page.

This works really well for a lot of apps. If your state lives on the server — admin tools, CMS interfaces, data tables with server-side filtering — this is a natural fit. The server already knows the current state; it just renders the updated HTML. The client stays thin. There is not much JavaScript to worry about.

HTMX in particular has shown that this model covers more ground than you might expect. A surprising amount of UI that looks like it needs client-side rendering actually does not — it just needs fast partial updates. And if your server is quick, those can be very fast.

The limits show up when you need something to respond instantly to local state — something the user just typed, a toggle they just clicked. Datastar has a signals system for this; HTMX can be extended. But either way it feels like going against the grain. These tools are built around server-rendered fragments triggered by user actions. Adding client-side state management on top means doing it without the structural support the rest of the tool provides.

It is not that these tools cannot handle client state — they can. The question is whether client state is a small part of your app or a big one. When it is small, hypermedia is often the right fit. When it is central, the workarounds pile up.

## The gap

So we have two ends of a spectrum. SPA frameworks at one end: the client owns rendering and state. Hypermedia frameworks at the other: the server owns everything, the client just requests new fragments.

In the middle is a large class of apps that neither serves well. They are server-rendered — the HTML comes from PHP, Python, Ruby, Java, whatever the team already has. They are **progressively enhanced** — the page works and makes sense before JavaScript loads. And they have real client-side state — values that change when the user interacts, where you do not need to ask the server and waiting for one would just feel slow.

This is where Le Truc lives — though not only here.

The starting point is: the server renders everything. JavaScript adds on top only where it needs to. When the user interacts, Le Truc updates only the DOM nodes that depend on what changed — it knows which ones because the reactive dependency graph was built when the component connected. No virtual DOM, no diffing, no network request unless the interaction actually needs one. State is explicit, effects are declarative, and changes flow automatically. You also avoid the double-data problem — you do not need to ship the same content as both HTML and JSON. The HTML is the source of truth.

But Le Truc does not lock you into that pattern. Client-side rendering, Shadow DOM, and HTML partial loading are all supported — the same things SPA frameworks, Lit, and HTMX do respectively. What changes is that none of these are the default. They are options you reach for when they genuinely fit, not assumptions baked into everything from the start.

## What each got right

Le Truc borrows directly from each of these families.

From SPA frameworks — SolidJS in particular — the idea that components, reactivity, and type safety are what let a frontend scale. SolidJS's fine-grained reactive model and async-first design have the clearest influence on how Le Truc handles state and effects.

From Lit, the idea that Web Components are the platform's own component model — a standard that works across stacks without needing a bridge layer. That is what real reusability looks like.

From HTMX and Datastar, the idea that the server is still the right place to assemble templates and data. Server-rendered HTML is a solid foundation, not a legacy. Partial HTML responses — sending only what changed — are a clean way to keep that foundation while avoiding full-page reloads.

**Consider Le Truc** if your project fits all three of these:

- The HTML is server-rendered, in whatever backend your team already uses.
- You want meaningful content visible before JavaScript loads — for performance, SEO, resilience, or all three.
- Some interactions need to be instant, reacting to local state without a round trip to the server.

If that sounds like your situation, Le Truc's fine-grained DOM updates driven by a signal graph cut out a lot of unnecessary complexity. The aim is to keep the common case simple, while still being able to handle the cases that need more.
{% /section %}
