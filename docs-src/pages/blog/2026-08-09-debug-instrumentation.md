---
title: Debug Instrumentation
description: Every component now gets a per-instance debug flag in DEV_MODE builds, showing exactly which on(), pass(), and watch() calls are firing and where.
emoji: 🐛
layout: blog
date: 2026-08-09
author: Esther Brunner
tags: release, debugging
---

{% section %}
`DEV_MODE` has always caught the failures you'd otherwise trip over blind: a child component that never activated within the 200ms window or a parser you forgot to brand. What it never told you was what was actually happening on a working page. Which `watch()` re-ran when you clicked that button? Did `pass()` reach the child you meant it to reach? You could `console.log` inside your own handlers, but that meant editing the component, and it meant every instance logged at once — no way to point at just the one you were debugging.

That's what `debug` fixes.

## A property that shows up on its own

Build your app with `DEV_MODE=true` and every component gets a reactive `debug: boolean` property. Not just the ones you wrote. Any component, including one from a third-party package you're integrating and can't easily edit.

```ts
document.querySelector('my-widget').debug = true
```

Flip it from the console, from the browser's properties panel, or by holding `Cmd`/`Ctrl` and clicking the element. Nothing changes in the component's own source — there's no `expose()` call to add, no extension to import. `defineComponent()` appends `debug()` to every component's extensions itself, the moment `DEV_MODE` is on.

That's a real exception to how the rest of Le Truc's extensions work. `formAssociated()` and `observedAttributes()` are opt-in — you import them and pass them explicitly, like we [wrote about a couple of weeks ago](./2026-07-24-component-extensions.html). `debug()` can't be opt-in and still do its job. If you had to edit a component to instrument it, you'd only ever debug components you already understood well enough to edit. The whole point is the other case.

## What you see once it's on

While `debug` is `true` on an instance, three things happen:

- The host itself gets a pulsing outline every time `on()`, `pass()`, or `watch()` fires for it — even a `watch()` handler with no element to point at still lights up the host, so nothing happens silently.
- Where Le Truc actually knows which DOM element a firing touched, that element gets marked with a `data-le-truc-on`, `-pass`, or `-watch` attribute and its own short pulse, color-coded so you can tell the three apart at a glance.
- Each firing writes one line to `console.debug()`, naming the component and, where relevant, the event or the target:

```
[le-truc debug] on "click" in <button-counter> from <button>
[le-truc debug] pass from <color-picker> to <color-swatch>
[le-truc debug] watch in <button-counter>
```

## Attribution is exact, not guessed

`on(target, ...)` and `pass(target, ...)` always know their element — it's right there in the call. `watch(source, handler)` is trickier: `handler` is just a function, and Le Truc has no general way to ask a closure which DOM node it touches.

For the common case, though, it doesn't need to guess. Every `bind*` helper — `bindText`, `bindProperty`, `bindClass`, and the rest — already closes over the element it's writing to. In a `DEV_MODE` build, each one registers that closure against its element the moment it's created. When `watch()` fires later, it looks the handler up in that registry. If it's there, the element gets marked. If `watch()` was called with some other handler — one you wrote by hand — there's no mark, only the host-level pulse.

## Zero cost when you're not looking

None of this exists in a production build. Not "hidden" — it doesn't get bundled, and the property it depends on is never added to the component in the first place. Setting `someElement.debug = true` on a production build does nothing, because there's no `debug()` extension merged in to provide the property. This is the same `process.env.DEV_MODE === 'true'` build-time guard that keeps every other dev-only diagnostic out of what you ship, applied to something with a UI this time instead of just a `console.warn`.

There's one sharp edge worth knowing about before it surprises you: `debug` becomes a reserved property name on every component in a `DEV_MODE` build, whether or not that component ever touches `debug()` itself. If you write `expose({ debug: someValue })`, it throws in development and works fine in production — the same component, two different outcomes depending on how it was built. If you hit that error, rename the prop.

## Try it

Run the examples locally, open the console, and flip `debug` on something with a few `on()` and `watch()` calls. Clicking around a component you already know well is a good way to build intuition for what the log lines mean before you reach for it on something you don't.
{% /section %}
