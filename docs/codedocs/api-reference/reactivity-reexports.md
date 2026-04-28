---
title: "Reactivity Re-exports"
description: "Reference for the Cause & Effect primitives that Le Truc re-exports from its root entry point."
---

Le Truc re-exports a large slice of `@zeix/cause-effect` directly from `index.ts`, so application code can import component helpers and signal primitives from one package:

```ts
import {
  batch,
  createComputed,
  createEffect,
  createList,
  createMemo,
  createMutableSignal,
  createScope,
  createSensor,
  createSignal,
  createSlot,
  createState,
  createStore,
  createTask,
  match,
} from '@zeix/le-truc'
```

Le Truc does not wrap these APIs. It forwards them unchanged from `@zeix/cause-effect@1.3.2`.

## Core Graph Primitives

```ts
function batch(fn: () => void): void
function createScope(fn: () => MaybeCleanup, options?: ScopeOptions): Cleanup
function untrack<T>(fn: () => T): T
function unown<T>(fn: () => T): T
function createComputed<T extends {}>(
  callback: TaskCallback<T>,
  options?: ComputedOptions<T>,
): Task<T>
function createComputed<T extends {}>(
  callback: MemoCallback<T>,
  options?: ComputedOptions<T>,
): Memo<T>
```

Exported variables:

```ts
const DEFAULT_EQUALITY: <T extends {}>(a: T, b: T) => boolean
const DEEP_EQUALITY: <T extends {}>(a: T, b: T) => boolean
const SKIP_EQUALITY: (_a?: unknown, _b?: unknown) => boolean
```

## Signals, State, Store, Slot, Task

```ts
function createSignal<T extends {}>(value: Signal<T>): Signal<T>
function createSignal<T extends {}>(value: readonly T[]): List<T>
function createSignal<T extends UnknownRecord>(value: T): Store<T>
function createSignal<T extends {}>(value: TaskCallback<T>): Task<T>
function createSignal<T extends {}>(value: MemoCallback<T>): Memo<T>
function createSignal<T extends {}>(value: T): State<T>

function createMutableSignal<T extends {}>(value: MutableSignal<T>): MutableSignal<T>
function createMutableSignal<T extends {}>(value: readonly T[]): List<T>
function createMutableSignal<T extends UnknownRecord>(value: T): Store<T>
function createMutableSignal<T extends {}>(value: T): State<T>

function createState<T extends {}>(value: T, options?: SignalOptions<T>): State<T>
function createStore<T extends UnknownRecord>(value: T, options?: StoreOptions): Store<T>
function createSlot<T extends {}>(
  initialSignal: Signal<T> | SlotDescriptor<T>,
  options?: SignalOptions<T>,
): Slot<T>
function createTask<T extends {}>(
  fn: (prev: T, signal: AbortSignal) => Promise<T>,
  options: ComputedOptions<T> & { value: T },
): Task<T>
function createTask<T extends {}>(fn: TaskCallback<T>, options?: ComputedOptions<T>): Task<T>
```

## Collections and Sensors

```ts
function createList<T extends {}, S extends MutableSignal<T> = MutableSignal<T>>(
  value: T[],
  options?: ListOptions<T, S>,
): List<T, S>

function createCollection<T extends {}, S extends Signal<T> = Signal<T>>(
  watched: CollectionCallback<T>,
  options?: CollectionOptions<T, S>,
): Collection<T, S>

function createSensor<T extends {}>(
  watched: SensorCallback<T>,
  options?: SensorOptions<T>,
): Sensor<T>
```

## Matching and Effects

```ts
function createEffect(fn: EffectCallback): Cleanup
function match<T extends {}>(
  signal: Signal<T>,
  handlers: SingleMatchHandlers<T>,
): MaybeCleanup
function match<T extends readonly Signal<unknown & {}>[]>(
  signals: readonly [...T],
  handlers: MatchHandlers<T>,
): MaybeCleanup
```

## Type Guards

```ts
function isAsyncFunction(value: unknown): value is (...args: unknown[]) => Promise<unknown>
function isCollection<T extends {}, S extends Signal<T> = Signal<T>>(value: unknown): value is Collection<T, S>
function isComputed<T extends {}>(value: unknown): value is Memo<T>
function isFunction<T extends (...args: any[]) => any = (...args: any[]) => any>(value: unknown): value is T
function isList<T extends {}, S extends MutableSignal<T> = MutableSignal<T>>(value: unknown): value is List<T, S>
function isMemo<T extends {} = unknown & {}>(value: unknown): value is Memo<T>
function isMutableSignal(value: unknown): value is MutableSignal<unknown & {}>
function isRecord(value: unknown): value is Record<string, unknown>
function isSensor<T extends {} = unknown & {}>(value: unknown): value is Sensor<T>
function isSignal<T extends {}>(value: unknown): value is Signal<T>
function isSignalOfType<T extends {}>(value: unknown, type: string): value is Signal<T>
function isSlot<T extends {} = unknown & {}>(value: unknown): value is Slot<T>
function isState<T extends {} = unknown & {}>(value: unknown): value is State<T>
function isStore<T extends UnknownRecord>(value: unknown): value is Store<T>
function isTask<T extends {} = unknown & {}>(value: unknown): value is Task<T>
```

## Error Classes and Utility Types

Le Truc also re-exports these classes unchanged:

- `CircularDependencyError`
- `InvalidCallbackError`
- `InvalidSignalValueError`
- `NullishSignalValueError`
- `ReadonlySignalError`
- `RequiredOwnerError`
- `UnsetSignalValueError`

And these types:

- `Cleanup`
- `Collection`
- `CollectionChanges`
- `CollectionOptions`
- `ComputedOptions`
- `EffectCallback`
- `Guard`
- `List`
- `ListOptions`
- `MatchHandlers`
- `MaybeCleanup`
- `MaybePromise`
- `Memo`
- `MemoCallback`
- `ScopeOptions`
- `Sensor`
- `SensorOptions`
- `Signal`
- `SignalOptions`
- `SingleMatchHandlers`
- `Slot`
- `SlotDescriptor`
- `State`
- `Store`
- `StoreOptions`
- `Task`
- `TaskCallback`

Use these directly when you want the lower-level reactive graph, but prefer Le Truc’s component helpers when the job is DOM enhancement inside custom elements.
