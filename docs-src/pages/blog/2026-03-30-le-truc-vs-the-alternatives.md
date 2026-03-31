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
Each family of web development tools is **designed to solve a specific problem**. Choosing the wrong one means carrying costs that don't belong to you. This post covers the main families, describes what each does well, and explains where Le Truc sits in the wider ecosystem — not to position it as universally superior, but to help you figure out whether it is right for you.

## SPA frameworks: when the client owns the UI

React, Vue, Angular, and Svelte share a core architectural decision: the framework takes ownership of rendering. You **describe what the UI should look like** as a function of state, and the framework figures out how to make the DOM match. Virtual DOM diffing, compiled templates, fine-grained reactivity — these are different implementation strategies toward the same goal.

This model is a genuine solution to a genuine problem. When the UI is highly dynamic — dashboards that update in real time, drag-and-drop interfaces, complex forms with live validation across dozens of interdependent fields — managing imperative DOM mutations by hand becomes intractable. Declarative rendering gives you a mental model that scales. You stop thinking about "change this element" and start thinking about "this is what the UI looks like in this state." For the right kind of application, this is an enormous improvement.

But ownership has a price. Because the framework renders your HTML, the browser cannot show meaningful content until the JavaScript bundle has downloaded, parsed, and executed — at least on the initial load. The web platform's own pipeline, which turns HTML bytes into visible pixels, is bypassed. Server-side rendering (SSR) was the answer, and it works. React Server Components, Vue's Nuxt, SvelteKit all make SSR a first-class concern. But SSR in an SPA framework is not a return to simplicity. It is an additional layer — a server render to produce initial HTML, followed by client-side hydration that re-takes control. The framework needs to be able to re-render from scratch, so it must receive the same data as JSON (or equivalent) that it used to render the HTML, and it must reconcile the server-rendered markup with its own internal state tree. This is a real engineering cost. It compounds when your team operates multiple backends: the SSR runtime is a JavaScript layer running on the server, and integrating it with a PHP, Java, or Python backend means maintaining a translation point between two separate stacks.

None of this makes SPA frameworks wrong. For a greenfield product where the team controls the full stack, the UI is application-heavy, and the investment in the framework pays off over a long product lifespan, they remain the most ergonomic option. The question is whether that profile matches your project.

## Lit and the component library story

Lit occupies a specific and valuable niche. It is designed for *building component libraries* — reusable, distributable, framework-agnostic UI primitives. A button, a dialog, a data table, packaged once and consumed by any frontend, regardless of whether that frontend uses React, Vue, or plain HTML.

Shadow DOM is central to this. It creates a hard boundary around a component's internals: styles do not leak in, internal structure is not reachable from outside. For a component library, that is a feature. It means the library author controls the styling contract explicitly, and consumers cannot accidentally break internals by targeting an element three levels deep.

But Shadow DOM is the same reason Lit is a difficult choice outside the component library context. The hard boundary that protects a library component from its consumers becomes a barrier between components that belong to the same site — shared state, styles, and events all require explicit workarounds. And while server-side rendering is possible, the component still renders its own structure client-side regardless, giving away the very reason you reached for SSR in the first place.

For building a cross-framework design system that will be distributed as a package: Lit is probably the right tool.

## HTMX and Datastar: the Hypermedia comeback

HTMX and Datastar take a perspective that felt almost counterintuitive when they appeared: instead of moving rendering to the client, keep it on the server and extend HTML with the ability to **trigger network requests and update page fragments** in response. Click a button, and instead of JavaScript manipulating the DOM, the browser makes a request and the server returns a new HTML fragment that replaces part of the page.

This is a compelling model for a wide class of applications. Any interface where state is primarily server-side — admin dashboards, CMS interfaces, data tables with server-side filtering and sorting — maps naturally to this approach. The backend already knows the state; it just needs to render the updated HTML. The client stays thin. The JavaScript footprint is minimal. There is no client state management to reason about.

HTMX, in particular, has shown that the pattern generalizes further than expected. A surprising amount of web UI that appears to need client-side rendering actually does not — it just needs efficient partial page updates. And compared to full SPA renders, partial page replacement triggered by a network request can be very fast if the server is fast.

The friction appears when interaction needs to be instant and the state is already on the client. Datastar addresses this with a built-in signals system; HTMX can be extended to manage local state. Both can work — but doing so feels like stepping outside the primary mental model. The core pattern is server-rendered fragments triggered by user actions. Adding client-side state without a dedicated reactive system means managing that state ad hoc, without the same structural support the rest of the tool provides.

The question is not whether these tools can handle client state — they can — but whether client state is incidental to your application or central to it. When it is incidental, hypermedia is often the right fit. When it is central, the workarounds accumulate.

## The gap

We have now described two ends of a spectrum. At one end: SPA frameworks, where the client takes full ownership of rendering and state. At the other end: Hypermedia frameworks, where the server takes full ownership and the client merely requests new fragments.

In the middle is a large class of applications that are not cleanly served by either. They are server-rendered — the initial HTML comes from PHP, Python, Ruby, Java, whatever backend the team already uses. They are **progressively enhanced** — the page is meaningful before JavaScript loads. And they have genuine client-side state — values that change in response to user interaction, where computing the new value does not require a server and waiting for one introduces unnecessary friction.

This is where Le Truc lives — though not only here.

The default mental model is: the server renders everything. JavaScript enhances only what it needs to. When the user interacts, Le Truc updates only the DOM nodes that depend on the changed value — and it knows exactly which ones because the reactive dependency graph was set up when the component connected. No virtual DOM, no diffing, no network request unless the interaction actually requires one. State is explicit, effects are declarative, changes propagate without imperative wiring. The double-data problem — needing both HTML and JSON to represent the same content — does not arise. The HTML is the source of truth.

But Le Truc does not enforce that default. Client-side rendering, Shadow DOM, and HTML partial loading are all supported — the same patterns that define SPA frameworks, Lit, and HTMX respectively. What Le Truc changes is when you reach for them: each is a tool for cases where it is genuinely the right fit, not a starting assumption. The common case stays as simple as possible.

## What each got right

Le Truc draws directly from each of these families.

From SPA frameworks — and SolidJS in particular — the insight that components, reactivity, and type safety are essential for an architecture that scales. SolidJS's fine-grained reactive model and async-first design are the clearest influence on how Le Truc handles state and effects.

From Lit, the insight that Web Components are the platform's native component model — a standard, framework-agnostic primitive that interoperates across stacks without a translation layer. Real reusability follows from that.

From HTMX and Datastar, the insight that the server is still the right place to bring templates and data together. HTML rendered on the server is a correct starting point, not a legacy constraint. Partial HTML responses — serving only what changed — are an elegant way to keep that model while avoiding full-page reloads.

**Consider Le Truc** if your project has all three of the following:

- The HTML is server-rendered, in whatever backend language your team already uses.
- You want meaningful content visible before JavaScript loads — either for performance, SEO, resilience, or all three.
- Some interactions need to be instant, responding to local client state without a network round trip.

If those describe your context, Le Truc's fine-grained DOM updates driven by a signal graph remove a significant amount of accidental complexity. The goal is to keep the common case simple while remaining capable enough for cases that require more.
{% /section %}
