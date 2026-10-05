---
name: cause-effect
description: Non-obvious semantics of the @zeix/cause-effect reactive primitives that @zeix/le-truc re-exports (State, Memo, Task, Sensor, Slot, Store, List, deriveList, createEffect, createScope, match, batch). Use for signal-level questions - async Tasks and pending state, equality, ownership and disposal, errors thrown on read, keyed collections. For authoring or debugging a Le Truc component (defineComponent, expose, watch, on, pass), use the le-truc skill instead.
---

Describes **@zeix/cause-effect 1.5.x** (verified against 1.5.2), as re-exported by **@zeix/le-truc 3.x**. Exported signatures and JSDoc cover the rest; this file lists only what a developer used to Solid or Preact signals gets wrong. When this file and the installed `node_modules/@zeix/cause-effect/src/` disagree, the source wins.

Import from `@zeix/le-truc`. It re-exports the public surface except the deprecated helpers `isEqual` (use `DEEP_EQUALITY`), `valueString` and `isObjectOfType`. Component-level behavior is in [`../le-truc/SKILL.md`](../le-truc/SKILL.md).

## Values: no nullish, and reads can throw

- Every signal is `T extends {}`. Writing `null`/`undefined` to a State, Sensor, Store property or List item throws `NullishSignalValueError`, and so does `createStore({ x: undefined })`. To model absence, omit the key and use `add`/`remove`, a wrapper object, or a sentinel.
- `.get()` throws `UnsetSignalValueError` when there is no value: an unseeded Task before it first resolves, an unseeded Sensor before its first `set`, a **Memo whose callback returned `undefined`** (`list.find(...)`). `match()` routes that error to `nil`.
- A Memo or Task that throws caches the error, and every `.get()` rethrows it until a dependency changes. A rejected Task **keeps its previous value but still throws on read**, so `err` hides the retained value. A repeat rejection with the same `name` and `message` does not propagate again.
- `state.set(fn)` stores `fn` as the value. `.update(prev => next)` is the updater. In contrast, `createSignal(fn)` builds a Memo (or a Task for an `async` fn), so storing a function needs `createState`.

## Sync vs async is decided from the function, not its result

- `createTask`, `deriveCell` and `deriveList` choose async by checking `Object.getPrototypeOf(fn) === AsyncFunction.prototype`. A plain function that *returns* a Promise counts as sync, and the first read throws `PromiseValueError`. A build that transpiles `async` below ES2017 breaks this detection.
- **A Task tracks only the reads made before its first `await`.** Read every dependency synchronously at the top of the callback, then await.
- Tasks are lazy: nothing runs until something reads the Task. When a dependency changes, the in-flight run's `AbortSignal` aborts immediately, and the next run starts on the next read. A result from an aborted run is discarded.
- `abort(task)` cancels the current run and clears pending, but the Task keeps its old value until a dependency changes again.
- `isPending(signal)`/`abort(signal)` (free functions, preferred over the deprecated methods) work on any signal. They return `false` / do nothing for a non-async origin. A `deriveList`/`deriveStore` built from an `async` function reports its pending state. A `deriveList(source, asyncItemFn)` does not report pending, and its `.get()` leaves out items that have not resolved yet.
- Option names differ: `createMemo`/`createTask` take `{ value }`, while `deriveCell`/`deriveList`/`deriveStore` take `{ initial }`. `deriveCell(value, { watched: set => cleanup })` creates a Sensor.

## Propagation, equality, batching

- Writes are synchronous and push-pull. Outside `batch`, `set()` flushes effects before it returns, so **`set()` rethrows errors thrown by any effect it triggered** (as an `AggregateError` when more than one throws). The other effects still run.
- Inside `batch(fn)`, reading a Memo returns the fresh value. Only effects are deferred until the outermost batch ends.
- `equals` (default `===`) is checked on write and on recompute. An equal result stops propagation for the whole downstream subtree. The defaults are not uniform: List items, `store.set` diffing, and `deriveStore` properties use `DEEP_EQUALITY` (structural; Date/RegExp by value; cycle-safe). `SKIP_EQUALITY` re-propagates every write; use it with a Sensor that re-`set`s the same mutated object.
- An effect that writes to its own dependency re-runs until the graph settles. After 1000 flush passes it throws `EffectConvergenceError`. A Memo that reads itself throws `CircularDependencyError`.

## Ownership and disposal

- `createEffect` runs synchronously on creation and registers its disposal on the active owner **if there is one**. Without an owner it does not throw, but nothing ever disposes it except the returned function.
- `createScope(fn)` registers on the parent owner. Inside a re-running effect, that means it is **disposed on the effect's next run**. `{ root: true }` skips the registration, so the returned `dispose` is the only teardown. Use it when an external lifecycle owns cleanup (`disconnectedCallback`, per-key bookkeeping).
- `untrack(fn)` stops dependency tracking but stays under the current owner. `unown(fn)` detaches from the owner but still tracks dependencies.
- Only reads made synchronously inside an effect or memo are tracked. An `async` effect callback tracks nothing after its first `await`, and its returned Promise is not treated as a cleanup.
- `watched` lifecycles (Sensor, Memo/Task `watched`, List/Store `watched`, `deriveList(seed, { watched })`) start only when a signal is read **inside an effect or computation**, and stop when the last subscriber unlinks. A read outside a reactive context never starts them. A read inside a branch that was not taken delays activation.

## `match(signals, handlers)`

- Throws `RequiredOwnerError` outside an owner (effect or scope).
- Precedence: `nil` > `err` > `stale` > `ok`. A missing `nil` renders nothing while unset; it does not fall back to `ok`. A missing `err` logs with `console.error`. A throw inside `ok` is routed to `err`.
- `stale` fires when an argument has a value and `isPending()` is true for it: a Task, a Slot whose current backing is a Task (followed through a chain of Slots), or a list or store derived from an async computation. It never fires for a State or a Memo. A Task seeded with `{ value }` routes to `stale` already during its first run. `stale` gets no arguments.
- **A cleanup returned by a sync handler is returned from `match`, not registered.** Write `createEffect(() => match(...))` or `return match(...)`. A bare `match(...)` statement drops the cleanup. A cleanup resolved from an async handler registers on the owner, unless the effect re-ran or was disposed first.
- Async handlers cannot be cancelled, and a stale rejection still reaches `err`. Keep signal writes out of them and model async state as a Task.

## Slot

A Slot is a stable reactive position with a swappable backing signal. Subscribers link to the Slot, so `replace(next)` re-notifies them without re-subscribing. A plain `{ get, set? }` descriptor is accepted as a backing too, and its `get` is tracked like a Memo. The Slot itself is a valid `Object.defineProperty` descriptor. `set` forwards to the backing signal (`ReadonlySignalError` if it has no `set`), and there is no `update`.

In Le Truc, a writable `expose()`d property (a static value, a `State`, or a `{ get, set }` descriptor) is Slot-backed, while a read-only derived one (a thunk) is stored as its bare Memo or Task. `pass()` swaps the child's Slot backing (restored on disconnect), and `requestContext()` returns a Slot. Because `match()` resolves `stale` through the Slot, a child's `watch('prop', { stale })` fires when `pass()` puts an async thunk behind that prop's Slot. Details are in the le-truc skill.

## Naming bridge to 2.0

`Signal` is the umbrella type. `Cell` (`State | Memo | Task | Sensor`) is the single-value shape. `deriveCell` replaces `createComputed`/`deriveSignal`, `createCell` replaces `createMutableSignal` for single values, and `deriveList` replaces `createCollection`/`.deriveCollection()`. The types `List`/`Store`/`Collection` are deprecated aliases of `MutableList`/`MutableStore`/`DerivedList`. At 2.0 `List`/`Store` become the readonly bases. The origin types and guards (`State`, `Memo`, `Task`, `Sensor`, `isState`, `isTask`, …) are deprecated with no replacement. Annotate with `Cell<T>`/`Signal<T>` and use `isPending`/`abort`.

Collections (Store, List, DerivedList, deriveStore): [`references/collections.md`](references/collections.md).
