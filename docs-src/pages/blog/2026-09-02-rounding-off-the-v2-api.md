---
title: Rounding Off the v2 API
description: Le Truc 2.6 adds bindAria(), map-form binding helpers, a fully typed multi-signal watch(), and ElementInternals registration for accessibility tooling — closing out what earlier 2.x releases left open.
emoji: ♿
layout: blog
date: 2026-09-02
author: Esther Brunner
tags: release, accessibility, typescript
---

{% section %}
Le Truc 2.6 ships no new concepts. It finishes three things v2.0 through 2.5 left open and fixes one TypeScript inference bug that's been there since the beginning.

## The tooling caught up

[When Le Truc 2.3 adopted `ElementInternals`](./2026-07-21-form-participation-with-elementinternals.html), it took form association and custom `:state()` pseudo-classes, and it left ARIA reflection alone. The reason was concrete: axe-core couldn't see `internals`-set roles without producing false positives, and Chromium didn't reliably update the accessibility tree from them either. Shipping `bindAria()` at the time would have handed you a helper that made your components less auditable, not more.

Both of those blockers are gone. axe-core 4.13 turned on ElementInternals support by default and closed the false positives. Chromium's accessibility tree picks up `internals`-set state reliably now. One condition comes with that support: axe only looks at a component's `internals` if the page registers them through the [ElementInternals declaration community protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/element-internals-declaration.md) — a shared `WeakMap` on `globalThis` that any accessibility tool can read. Without that registration, axe silently audits your component as if `internals` didn't exist.

So Le Truc 2.6 registers them for you: every component's constructor already calls `attachInternals()`, and 2.6 adds one line next to it, putting the instance in the registry. No opt-in, no configuration, one `WeakMap` write per instance. Run axe-core ≥ 4.13 against a Le Truc app and it can finally see that your components use `internals` at all — for now it reads only `internals.role`, and only in a subset of rules.

## `bindAria()`, the helper that was missing

With the tooling caught up, nothing held `bindAria()` back. It reflects a value onto an ARIA property on any `ARIAMixin` target — an `Element` or `ElementInternals` — the same way `bindProperty()` and `bindState()` reflect onto their targets:

```ts
watch('expanded', bindAria(internals, 'ariaExpanded'))
```

or keeps `aria-activedescendant` pointed at whichever option the keyboard is on:

```ts
watch(activeOption, bindAria(listbox, 'ariaActiveDescendantElement'))
```

It does the coercion you'd otherwise hand-roll at every call site: a boolean becomes `'true'` or `'false'`, a number becomes a decimal string, `null` or `undefined` clears the reflection. It also does something you wouldn't think to hand-roll at all. The platform gives attributes the final say: a server-rendered `aria-expanded="false"` attribute shadows anything you write to `internals.ariaExpanded` afterward — silently. `bindAria()` removes that attribute once, on the first value it writes, so the server-rendered value acts as the true initial state and the component owns the property from then on.

Reflecting through `internals` instead of an attribute buys you two things. The value is invisible in markup, so no framework rewriting the host's attributes can clobber it. And the attribute channel stays open for exactly one thing: consumer overrides — a consumer who sets `aria-expanded` still wins.

## Syncing more than one thing from one source

`bindStyle()`, `bindAttribute()`, `bindClass()`, `bindProperty()`, `bindState()`, and `bindAria()` each targeted exactly one thing per call. If one computed value drove three of them — say a knob position that sets `top`, `left`, and a border color — you wrote three separate `watch()` calls sharing the same computation, or you gave up on the helpers and wrote `element.style.setProperty()` by hand inside a plain callback.

`form-colorgraph`'s color-picker knob used to do the latter. Now it doesn't:

```ts
watch(
	() => {
		const { l, c } = color.get()
		const size = canvasSize.get()
		return {
			top: `${Math.round((1 - l) * size)}px`,
			left: `${Math.round((c * size) / AXIS_MAX.c)}px`,
			'--color-border': l > CONTRAST_THRESHOLD ? 'black' : 'white',
		}
	},
	bindStyle(knob, ['top', 'left', '--color-border']),
)
```

One computation, one `watch()` call, three DOM writes, and `nil` cleanup for all three properties at once. The same array of keys works on `bindAttribute()`, `bindClass()`, `bindProperty()`, `bindState()`, and `bindAria()`. The single-target calls you already have keep working exactly as before — this is purely additive.

## `watch()` finally tells the truth about types

This one isn't new behavior. Passing an array of signals to `watch()` and getting back a tuple has always worked at runtime — it's inherited straight from Cause & Effect. But the array-source overload typed the callback's values as `any[]`, so autocomplete and type-checking died the moment you watched more than one signal.

That's fixed. `watch([nameSignal, ageSignal], ([name, age]) => ...)` now infers `[string, number]`, not `any[]`. `ok`/`nil`/`err`/`stale` match handlers on multi-source `watch()` calls get the same tuple typing. This is 2.6 catching TypeScript up to what the library already did.

## Also in this release

The docs site got reorganized for easier navigation, source comments got trimmed down to the ones that earn their keep, and some skills picked up sharper workflows and updated API signatures.

If you're already on 2.5, nothing in 2.6 asks you to change a line — no deprecations, no behavior changes. If you've been holding off on `internals.aria*` because of the axe-core caveat in the 2.3 post, that blocker is gone: read [ADR 0026](https://github.com/zeixcom/le-truc/blob/main/adr/0026-aria-reflection-via-elementinternals-and-bindaria.md) for the full two-channel policy, or look at `bindAria()`'s entry on the [accessibility page](../accessibility.html).
{% /section %}
