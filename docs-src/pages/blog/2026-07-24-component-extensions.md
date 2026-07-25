---
title: Component Extensions
description: Le Truc 2.3 introduces a tree-shakable extension interface for defineComponent. The first three extensions cover form participation and attribute-driven reactivity for React interop.
emoji: 🧩
layout: blog
date: 2026-07-24
author: Esther Brunner
tags: release, architecture
---

{% section %}
Our first attempt at form participation was through an `options` object: `defineComponent(name, factory, { formAssociated: true })`. That design had a cost hiding in it. To read that flag, `component.ts` had to import the form-association code — `ElementInternals`, the managed value sync, the host contract, all of it — unconditionally, for every consumer, whether they wrote a form control or not. About 1.2 kB gzipped, paid on every page that loaded the library.

The fix is a new third parameter: an array of **extensions**. `component.ts` no longer imports any feature module directly. It only knows the generic `ComponentExtension` shape. Every feature lives in its own file under `src/extensions/`, and a consumer who never imports it never bundles it.

```ts
defineComponent('form-textbox', factory, [formAssociated()])
```

That's the whole mechanism. The form code from the [previous post](./2026-07-21-form-participation-with-elementinternals.html) — `formAssociated()` and its `checked`-keyed sibling `formAssociatedCheckbox()` — is now the primary use case for it. If you've read that post, you already know what those two do; this post is about the interface they sit on, and the third extension that ships alongside them.

## What an extension is

An extension is a plain data and function bundle. It declares a `name` (for error messages), optional `staticProps` to install on the generated class (like `static formAssociated = true`), `observedAttributes` and `reservedMembers` it contributes, and up to three lifecycle hooks: `installOnPrototype` (once per class, before `customElements.define`), `onConnect` (once per instance, after the factory runs), and `onAttributeChanged` (on every observed-attribute mutation).

`defineComponent` folds the array once, at class-definition time. `staticProps` keys can collide, so the merge has a policy: in dev mode, two extensions declaring the same key throw `ExtensionCollisionError`; in production, the first declaration wins and the rest are ignored. `observedAttributes` and `reservedMembers` can't conflict — they're unions, combined across every extension in the array.

The contract is public, so writing a custom extension is possible. But the bundled ones are the intended norm, and they cover the cases we've seen come up.

## `observedAttributes()`: an opt-in for React

Properties are the reactive interface in Le Truc. A `Parser` passed to `expose()` reads its attribute once, at connect time — after that, the attribute is inert. That's a deliberate choice, and it's the right default. You set state through events or property writes, not by mutating attributes from the outside.

There's one framework that disagrees. React sets DOM *attributes* on custom elements, not properties — a long-standing consequence of how React models the DOM. If a React app updates `<basic-gauge value="0.5">`, it calls `setAttribute('value', '0.5')`, and under the default convention nothing happens after the first paint.

The `observedAttributes()` extension is the opt-in escape hatch for that case:

```ts
defineComponent<BasicGaugeProps>(
  'basic-gauge',
  ({ expose, first, host, watch }) => {
    expose({ value: asNumber() })
    watch('value', v => { /* update the gauge */ })
  },
  [observedAttributes(['value'])],
)
```

Named attributes are added to the class's `static observedAttributes`. On each mutation, the extension re-runs the same `Parser` it retained from `expose()` against the attribute's new string value and writes the result to the prop. Props whose initializer isn't a branded `Parser` are left alone.

## Don't reach for it by default

The extension exists for a specific interop problem, not as a general pattern. Le Truc's reactivity runs on properties and signals for a reason: an attribute is a serialized string, parsed once at the edge, while a property carries a typed value through the reactive graph. Wiring attribute mutations into that graph on every change is more work, more parsing, and a stringly-typed bottleneck where there didn't have to be one.

If you're not integrating with a framework that forces attribute updates, keep using event handlers and property writes. `observedAttributes()` is a tool for a constraint you didn't choose, not a second reactive interface.

## An open interface

Three extensions ship today — `formAssociated()`, `formAssociatedCheckbox()`, and `observedAttributes()` — but the interface itself is the larger change. `component.ts` now has a single, generic injection point for class-level capabilities, and anything that belongs there can live behind it without the core knowing about it.

That includes things we haven't built yet. Better debug instrumentation — wiring component lifecycles into the devtools, surfacing effect execution, naming the scopes a component owns — is the kind of cross-cutting concern that fits an extension cleanly, and it's on the list for a future version. The mechanism is ready for it.
{% /section %}
