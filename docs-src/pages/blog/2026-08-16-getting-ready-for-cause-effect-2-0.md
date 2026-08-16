---
title: Getting Ready for Cause & Effect 2.0
description: Le Truc 2.5 backports Cause & Effect's new signal names so you can migrate before the breaking 2.0 release lands.
emoji: 🌉
layout: blog
date: 2026-08-16
author: Esther Brunner
tags: release, migration, cause-effect
---

{% section %}
Le Truc 2.5 doesn't add a feature you'll reach for on its own. It exists to make the next Cause & Effect release land without breaking your code.

## The gap that forced bad patterns

Cause & Effect's reactive primitives up to 1.4 covered nine signal types. They were indexed along two axes: what shape the data has (single value, keyed list, keyed record), and where the value comes from (mutable source, sync derivation, async derivation, external push). That four-by-three grid had gaps. The one that mattered most: you couldn't derive a `Store` or a `List` from a `Task`. Fetch some JSON, key it, and turn it into a reactive list or object — there was no direct path.

So people wrote this instead:

```ts
const user = createTask(async () => fetchUser(id.get()))
const store = createStore({ name: '', email: '' })
createEffect(() => store.set(user.get()))
```

That's an imperative write inside an effect, syncing one signal into another by hand. We've always discouraged this pattern. It duplicates state. The effect also has to run on every change, instead of Cause & Effect propagating only what actually changed. But until now, it was the only door.

## What Cause & Effect 1.5 does about it

Cause & Effect 1.5 backports the fix without breaking anything yet. Three new functions — `deriveSignal`, `deriveList`, and `deriveStore` — replace the old split between `createComputed`/`createMemo` and the collection-specific derivation functions. Each one derives a signal of its matching shape from any source: a sync function, an async function, an external push, or another signal. That closes exactly the gap above — a `Task` can become a `Store` or a `List` directly, no manual effect required.

The old names — `createComputed`, `List`, `Store`, `createCollection`, and others tied to the previous nine-type taxonomy — still work in 1.5. They're marked `@deprecated` and point at their replacement. Nothing breaks yet. That's the point of a 1.x release. The renames are visible now. The removal happens later, in Cause & Effect 2.0.

## What Le Truc 2.5 does about it

Le Truc 2.5 re-exports every one of those new names next to the deprecated one it replaces. You can start using `deriveSignal`, `deriveList`, `MutableList`, `MutableStore`, and the rest today, without waiting for a major version bump on either library. [Cause & Effect's MIGRATION-2.0.md](https://github.com/zeixcom/cause-effect/blob/main/MIGRATION-2.0.md) has the full rename table. A codemod rewrites your imports automatically:

```sh
bun tools/codemod-v2.ts 'src/**/*.ts' --module @zeix/le-truc
```

Run it, review the diff, done. The one rename it can't do for you: `createComputed` → `deriveSignal` also renames the `value` option to `initial` — that one needs a manual pass.

## Why the names had to change

Two of the renames are more than cosmetic. Today, `List` means the mutable type — the thing you call `.add()` and `.remove()` on. Under the new taxonomy, `List` becomes the readonly base, and `MutableList` is the mutable one. `Store` gets the same flip: `createStore` used to return `Store`; from 2.0 it returns `MutableStore`, and `Store` becomes the readonly base.

That's a real breaking change, not a rename you can skip. Code that types a variable `List<T>` and calls `.add()` on it breaks at compile time — silently wrong until you rebuild, not silently wrong at runtime. Cause & Effect's team considered other options, including keeping `List` as the mutable name and introducing `Collection` as the readonly base. They dropped that path: "Collection" reads to most people, and to most language models, as something like a reactive `Map`, not a keyed list. A confusing name forever seemed worse than a well-flagged breaking rename now.

## What's still ahead

Le Truc 3.0 will follow Cause & Effect 2.0 once it ships. The deprecated re-exports go away, and the type surface collapses from nine names to six. If you migrate to the new names now, that jump is a version bump, not a rewrite. The full reasoning behind the type collapse — including why `Collection` doesn't survive as a name and why `Sensor` merges into `State` — is in Cause & Effect's [ADR 0018](https://github.com/zeixcom/cause-effect/blob/main/adr/0018-shape-indexed-signal-types.md).

One thing the codemod can't flag for you: `isSignal` and `isMutableSignal` keep their names in 2.0 but narrow what they match, from "any reactive value" to "single-value signal only". If you guard an `unknown` value with either today, check it by hand before you rely on it after the jump. The sooner your imports point at the new names, the smaller Le Truc 3.0 will feel when it arrives.
{% /section %}
