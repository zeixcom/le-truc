# Implementation Notes

## Phase 2: `run`, `each`, `on`, `pass` factory helpers

### `match()` requires `createEffect()` for reactivity

`match()` from `@zeix/cause-effect` reads signals synchronously but does **not** create reactive subscriptions on its own. Subscriptions are only created when `activeSink` is non-null, which only happens inside `createEffect()`. Calling `match()` directly inside `createScope()` (as `EffectDescriptor`s are activated) means signals are read once at connect time but never tracked — effects run on initial render but never re-run.

Fix: wrap `match()` inside `createEffect()`:

```ts
return createEffect(() =>
    match(signals, {
        ok: values => untrack(() => handler(values)),
    }),
)
```

Use `untrack()` around handler calls so incidental signal reads inside the handler don't become additional reactive dependencies. Only the explicitly declared source signals should trigger re-runs.

### `activeOwner` vs `activeSink` are independent

`createScope()` sets `activeOwner` (for cleanup registration) but leaves `activeSink` null. `createEffect()` sets both. Signal `.get()` only calls `link(node, activeSink)` if `activeSink` is non-null. This is why initial render works (values are read synchronously regardless of `activeSink`) but reactive updates don't fire without `createEffect()`.

### Slot restoration with Memo targets

When `pass(memo, props)` is used, a `createEffect` iterates the Memo and calls `effectPass` per element. Each per-element scope is owned by the `createEffect`. When an element leaves the Memo (DOM removal), the `createEffect` re-runs and disposes the old scope — running the slot restore cleanup (`slot.replace(originalState)`). This happens while the parent is still connected, restoring the child's independence as soon as it leaves the collection.

When an element re-connects after slot restoration (e.g. appended to a new location), `#initSignals` skips re-initialization (`prop in this` is already true), so the existing restored slot is used. The child's effects re-run with its own state signal.

### `#initSignals` skip-if-present guard

`#initSignals` checks `if (prop in this) continue` — so on reconnect, existing Slot-backed accessors are not recreated. The Slot from first connect persists. This makes slot restoration meaningful across disconnect/reconnect cycles.

### `defineComponent` overload resolution with type params

The v1.1 factory form requires exactly **one** type param `<P>`. Providing two (`<P, U>`) causes TypeScript to skip overload 1 (v1.1) and try overload 2 (v1.0 `ComponentFactory`), which fails because the return type is `FactoryResult` (array) not `ComponentFactoryResult` (object).

### `provideContexts` type inference

`provideContexts([...])` without an explicit type param infers `P = ComponentProps` (too wide). This causes type errors in `Effects<ContextMediaProps, ...>`. Fix: add explicit type param `provideContexts<ContextMediaProps>([...])`.

### Dynamic element test ordering matters for `each`

When testing per-element lifecycle with `each`, set the reactive prop **before** appending the new element. If the element is appended first, `each` re-runs and sets up `run`/`on` effects — but the `run` effect fires with the current signal value. If that value hasn't been set yet, you test the wrong state. Setting the prop first ensures the `run` effect fires immediately with the correct value when the element connects.

### Server resolves HTML by filename, not directory

`/test/:component` routes are resolved via `Bun.Glob(**/${componentName}.html)` — the server searches the entire examples tree by filename, not by directory path. Reorganizing components into subdirectories does not require changing spec `page.goto()` URLs.
