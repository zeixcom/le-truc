---
name: cause-effect
description: Expert guidance for @zeix/cause-effect reactive primitives (signals, memos, tasks, sensors, slots, stores, lists, collections, scopes). Use for signal-level questions, choosing the right primitive, or debugging reactivity — in le-truc projects or standalone.
user_invocable: true
---

## Purpose & Scope

**Cause & Effect** is the reactive state-management layer that powers Le Truc — a deliberately framework-less TypeScript primitives library (`State`, `Memo`, `Task`, `Sensor`, `Slot`, `Store`, `List`, `Collection`, `Effect`) in one unified signal graph. Use this skill for **signal-level questions**: choosing a primitive, reasoning about ownership/cleanup, async cancellation, or debugging reactivity.

**For building Le Truc components**, defer to the `le-truc` skill (factory form, `expose`/`watch`/`on`/`pass`, DOM bindings). **For working on the le-truc library internals**, defer to `le-truc-dev`. This skill covers the primitives themselves; cross-reference, don't duplicate.

Most of the public API is re-exported by `@zeix/le-truc`, so a separate `@zeix/cause-effect` install is usually unnecessary. The re-export is not guaranteed 1:1 forever (le-truc has dropped niche helpers like `valueString` from its surface); if an import fails from `@zeix/le-truc`, import it from `@zeix/cause-effect` directly.

> Written against **@zeix/cause-effect 1.4.0**. Verify against the installed `node_modules/@zeix/cause-effect/README.md` and `src/` on major upgrades. If the README and `src/` disagree, **`src/` wins**.

## Primitive Picker

| Need | Use | Notes |
|---|---|---|
| Writable source value | `createState(value)` | Use for primitives or objects you replace wholesale |
| External input (lazy lifecycle) | `createSensor(set => cleanup)` | Mouse, resize, media queries, geolocation, DOM observers. Read-only; `.get()` throws `UnsetSignalValueError` before first event unless `{ value }` seeds it |
| Sync derived (memoized) | `createMemo(fn)` | Re-derives only when tracked deps change. For cheap/simple derivations a plain function is faster |
| Async derived (cancellable) | `createTask(fn)` | Receives `(prev, abort: AbortSignal)`; auto-aborts in-flight work when deps change; exposes `.isPending()` and `.abort()` |
| Sync-or-async derived (auto-detect) | `createComputed(fn)` | Returns `Memo` or `Task` by checking whether `fn` is `async` — decided statically, before first run |
| Reactive object (keyed props) | `createStore(obj)` | Each property (recursively) becomes its own signal via Proxy. Direct proxy mutation throws `InvalidStoreMutationError` — use `.set`/`.update`/`.add`/`.remove` |
| Reactive array (stable keys) | `createList(arr)` | Per-item signals with persistent identity across sort/reorder. Update items with `.replace(key, value)` (not `.byKey(key).set()`) to reach all subscribers |
| External keyed collection | `createCollection(applyChanges => cleanup)` | WebSocket / SSE / Server-Sent Events feeds |
| Derived collection | `list.deriveCollection(fn)` | Sync or async mapping; chains for pipelines |
| Stable property position that swaps backing signal | `createSlot(signal)` | Integration layers (e.g. le-truc props). Doubles as an `Object.defineProperty` descriptor. `set()` forwards to the backing signal |
| Terminal side-effect sink | `createEffect(fn)` | Runs once immediately, re-runs on dep changes. Return a cleanup fn — it runs before each re-run and on dispose |

**Utilities:** `createSignal(value)` (polymorphic — infers type), `createMutableSignal(value)` (State/Store/List only), `createScope(fn, { root })` (ownership/cleanup), `batch(fn)`, `untrack(fn)`, `unown(fn)`, `match(signal(s), handlers)` (state routing), type predicates `isSignal` / `isMutableSignal` / `isState` / `isMemo` / `isTask` / `isSlot` / `isStore` / `isList` / `isComputed`. Equality helpers: `DEFAULT_EQUALITY` (`===`), `DEEP_EQUALITY` (structural), `SKIP_EQUALITY` (always re-propagate — for mutable-object observation).

## The Ownership Model (read this once)

Effects and scopes form an **ownership tree**. The single most important mental model:

- **`createEffect` registers on the active owner if one exists** — it does *not* itself throw. But a top-level effect (no active owner) is **never auto-disposed**: its cleanup runs only when you call the returned `dispose()` function, so it leaks until then. Always nest effects in a `createScope` unless you intend to own the lifetime manually. (In le-truc, `connectedCallback` provides the owner scope.)
- **`createScope(fn)`** runs `fn` with itself as the active owner; everything created inside registers cleanup there. Returns a single `dispose()` that tears it all down. Disposing a parent disposes children.
- **`{ root: true }` opts out** of parent-owner registration — the returned `dispose()` is the *sole* teardown. Required when an external lifecycle authority owns cleanup (e.g. a web component's `disconnectedCallback`).
- **Effect cleanups run before every re-run and on dispose.** Return a cleanup function from the effect callback for resources that must be released between runs (timers, observers, subscriptions).
- **Scopes created inside a re-runnable effect are disposed on every re-run** unless `{ root: true }` + manual bookkeeping. This is the exact mechanism behind le-truc's `each()` per-element loop.
- **`match()` is the one primitive that *does* require an active owner** — it throws `RequiredOwnerError('match')` without one, because it registers async-handler cleanup on the owner.

`untrack(fn)` suppresses **dependency tracking** (reads don't link edges) but still runs inside the current owner. `unown(fn)` suppresses **ownership registration** (scopes/effects created inside don't attach to the current owner) but still tracks deps. They answer different questions.

## `match()` Routing

Routing precedence inside an effect: **`nil` > `err` > `stale` > `ok`**.

- `nil` — any signal has no value yet (unseeded Task still in first computation; unseeded Sensor before first event).
- `err` — any signal holds an error. (`err` defaults to `console.error` if omitted.)
- `stale` — all signals have a retained value **and** at least one `Task` is re-computing (deps changed, new run in flight). Omitting `stale` falls through to `ok`, leaving the retained value in place during refresh.
- `ok` — all resolved. Single-signal `ok` receives the value directly; multi-signal receives a tuple.

Unseeded Task first read throws `UnsetSignalValueError` → routes to `nil`, **not** `stale`. Seed with `{ value }` to get `stale` semantics on refresh. `stale` is a thunk — it receives no arguments (the retained value is intentionally withheld).

**Async `ok`/`err` handlers are for fire-and-forget side effects only** (DOM, analytics, logging). Do **not** call `.set()` on signals inside an async handler — model the async value as a `Task` instead. Stale-run rejections still reach `err`, so state writes there become incorrect once a newer run has landed.

## Reference Index

All in `references/`:

| File | Contents |
|---|---|
| `primitives.md` | Per-primitive signatures, laziness/`watched` activation, equality, canonical examples |
| `pitfalls.md` | Verified sharp edges, failure modes, and one-line fixes |

For how **le-truc** uses these primitives internally (`Slot`-backed props, `all()` Memo, `batch()` in event handlers), see `../le-truc-dev/references/cause-effect-integration.md`.

## Authority

**Always verify against** `node_modules/@zeix/cause-effect/src/` — the source is authoritative over both this skill and the README when they disagree.
