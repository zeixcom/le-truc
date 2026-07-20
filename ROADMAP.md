# Le Truc — Roadmap

> This document describes _where the project is heading_ across releases: what's landed, what's next, and what we've deliberately decided not to pursue. For the problem, users, and constraints behind these decisions, see [REQUIREMENTS.md](REQUIREMENTS.md). For architectural rationale, see [ARCHITECTURE.md](ARCHITECTURE.md) and the [ADRs](adr/).

---

## Where we're heading: server components (v3.0)

Le Truc's contract today is **the server renders HTML; components upgrade in place** (ADR [0003](adr/0003-attributes-drive-state-at-connect-time-only.md)). There is no client-side templating and no VDOM — not even for lists, which are DOM-driven (`each()`) rather than data-driven.

The long-term goal is a **JSX- and/or TSRX-based authoring format for server components**, so a component can be written once instead of as three hand-maintained files (`.html` + `.css` + `.ts`) that drift against each other. The server half renders HTML (and extracts scoped CSS); the client half is the existing `defineComponent()` enhancement code — generated where possible, hand-authored where not. This is a **split compiler**, not a rendering framework: the server produces the truth, the client never re-renders, and Le Truc's "enhance, don't render" posture is preserved end to end.

This is a long-term direction, not a v3.0 deliverable in full. What v3.0 ships is the **precondition** the whole direction depends on:

### Landed toward this goal: `reconcile()` (v2.3)

Server components need a client-side answer to `.map()` in JSX / `for ... of` in TSRX — a way to keep a reactive list of data in sync with rendered DOM elements without re-rendering. That's `reconcile()` (ADR [0017](adr/0017-keyed-template-clone-reconciliation-for-lists.md)): a keyed template-clone reconciler that adopts server-rendered, keyed children as the source of truth on first run, then syncs additions, removals, and reorders from a `List`/`Collection` against the DOM by key — no client-side template language, one root `<template>` supplied by the author.

It replaces the hand-written, brittle reconciliation code that `module-list` and `module-todo` had to duplicate, and is Le Truc's first (deliberately bounded) primitive that creates DOM from data rather than only enhancing what the server already rendered.

### Next: TSRX as a server-side component format

The full design lives in git history (`PLAN-tsrx-server-components.md`, superseded by this roadmap) and will return as ADR 0019-or-later once we commit to it. In short:

- **What TSRX is.** A JSX-shaped template language (`.tsrx`, from the Ripple ecosystem) with real control flow (`@if`, `@for`, `@switch`), scoped `<style>` blocks, and a shared parser (`@tsrx/core`) with per-framework codegen targets (React, Preact, Solid, Vue, Ripple). There is no server/HTML target today — Le Truc would be the first.
- **The semantic gap.** Every existing TSRX target assumes the component renders and re-renders its own DOM. Le Truc's components never do. A Le Truc target must classify every expression as server-definitive (renders once, ships zero client JS) or reactive (needs a binding), using the same declared-roots principle Le Truc already relies on: reactivity only enters through props, context, or internal signals — everything else is server-definitive by construction.
- **The recommended starting point (Option C)** is an authored split, not compiler inference: a single `.tsrx` file contains a plain-TypeScript client export (unchanged `defineComponent()` code) alongside a server template compiled to an HTML-string render function, with the `<style>` block extracted and tag-scoped. No binding classification yet — that's a later phase, once the format itself is proven.
- **Sequencing.** `reconcile()` had to land first (done, v2.3) because reactive `@for` lowers directly onto it. After that: a no-compiler-code spike hand-writing the target design against two real components, then an Option C compiler wired into the build pipeline, then (only once that's stable) binding inference, then reactive lists via `reconcile()`.
- **What we're not chasing.** A full custom target with binding inference from day one (Option A) — too much design surface for a first target. TSRX as server-templating-only with hand-authored components staying as three files (Option B) — doesn't deliver the actual goal, since components would still drift.

## Server-side rendering strategies (general guidance)

Independent of the TSRX direction, this is how to structure a server layer around Le Truc components today — and remains valid regardless of how the authoring format evolves. Le Truc has no SSR of its own: the server produces HTML, and Le Truc components take over from `connectedCallback` onward, reading initial state from attributes, JSON attributes, slots, or Declarative Shadow DOM.

- **Static Site Generation** — pre-render at build time, serve plain files. What the docs site (`server/`) does today. Best for content that changes on a known schedule.
- **Server-Side Rendering** — render per request when content depends on the requester (auth, query params, personalization). Any HTTP server works; streaming lets above-the-fold components upgrade before slow data resolves.
- **Fragment-based navigation** — a router component intercepts link clicks, fetches only the changed region as an HTML fragment, and swaps it in; persistent components (nav, header) keep their signals alive across navigations. Degrades to full page loads without JS.
- **Optimistic mutations** — update signals immediately on user action, fire a background fetch, let the authoritative server response confirm or correct via `Store.update()` (which diffs and only propagates real changes).
- **Templating choice is independent of Le Truc.** Tagged template literals (what `server/templates/` uses today), JSX-without-React (`@kitajs/html`-style), traditional template engines, or Astro all produce valid input HTML — the reactive layer doesn't care how the HTML was made, only that it's correct.

## Dead ends: deprecated in 2.x, removed in 3.0

Two 2.x escape hatches are being retired because they undermine guarantees the rest of the library depends on. Both already emit `DEV_MODE` deprecation warnings in 2.3.

- **`pass()` writable-signal short forms.** `pass(child, { value: 'value' })` (property-key form) and `pass(child, { value: someState })` (bare-writable-signal form) hand a child component unrestricted `.set()` access to parent-owned state, with no chokepoint for the parent to validate or veto writes (ADR [0012](adr/0012-deprecate-unrestricted-write-short-forms-in-pass.md)). **Migration:** `() => host.value` for read-only access, or `{ get: parentSignal.get, set: parentSignal.set }` to keep writes mediated.
- **Returning an array of `EffectDescriptor`s from a factory.** The explicit-return contract (ADR 0007) is a silent footgun: dropping a descriptor from the returned array — a bare `watch(task, fn)` statement, a missed spread after a refactor — produces no error and no warning; the effect simply never runs. `watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` now register themselves when called (ADR [0018](adr/0018-implicit-effect-collection-via-ambient-context.md)); explicit `return [...]` still works in 2.3 for compatibility but is removed in 3.0. For the one case explicit return was still needed — a hand-authored `EffectDescriptor` wrapping a non-Le-Truc primitive — 2.3 also ships **`run()`**, a context helper that registers a raw descriptor the same way the others do. After 3.0, `FactoryResult`/`EffectDescriptor` are no longer part of the public return contract at all.

**Migration path:** both changes are non-breaking in 2.3 (dual support) and breaking in 3.0. Projects should adopt implicit collection and mediated `pass()` bindings now to avoid a cliff at the next major version.
