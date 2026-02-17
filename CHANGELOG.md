# Changelog

## 0.16.0

### Added

- **`createElementsMemo(parent, selector)`**: New function returning a `Memo<E[]>` of elements matching a CSS selector, backed by a lazy `MutationObserver` that activates only when read from within a reactive effect.
- **`createEventsSensor(init, key, events)`**: New function producing an event-driven `Sensor` from transformed event data, replacing the old Le Truc-specific `createSensor`.
- **New re-exports from `@zeix/cause-effect` v0.18**: `createCollection`, `createList`, `createMemo`, `createMutableSignal`, `createScope`, `createSensor`, `createTask`, `createStore`, `match`, and their associated types and type guards.
- **New type exports**: `MethodProducer`, `ContextCallback`, `UpdateOperation`, `SensorEventHandler`, `AllElements`, `FirstElement`, `ElementFromSelector`, and CSS selector type utilities (`ElementFromSingleSelector`, `ElementsFromSelectorArray`, `ExtractRightmostSelector`, `ExtractTag`, `KnownTag`, `SplitByComma`, `TrimWhitespace`).
- **`MaybeSignal<T>`** now accepts `TaskCallback<T>`, enabling async task-based property initializers.

### Changed

- **`@zeix/cause-effect` upgraded from `^0.16.1` to `^0.18.3`**. This drives most API changes below.
- **Element queries use `Memo<E[]>` instead of `Collection<E>`**: The `all()` query helper returns `Memo<ElementFromSelector<S>[]>`. The `UI` type is now `Record<string, Element | Memo<Element[]>>`.
- **`pass()` effect rewritten to use Slot signals**: Uses `getSignals()` and `slot.replace()` instead of overwriting property descriptors. Works regardless of descriptor configurability and avoids state leaks on cleanup.
- **`requestContext` returns `Memo<T>`** instead of `Computed<T>`.
- **Component property accessors use Slot signals**: `#setAccessor` in `defineComponent` now uses `createSlot` for mutable signals, with `slot.replace()` for signal swapping.
- **`Computed` renamed to `Memo`** and **`ComputedCallback` renamed to `MemoCallback`** in type signatures (from upstream `cause-effect` v0.18).
- **`updateElement`**: The unset sentinel changed from `UNSET` to `null`.
- **Eliminated `index.dev.ts`**: Both `index.js` (minified) and `index.dev.js` (unminified) are now built from the single `index.ts` entry point.

### Removed

- **`src/signals/collection.ts`**: The Le Truc-specific `Collection` signal type with `MutationObserver`, `Proxy`, and add/remove listeners has been removed. Element collection functionality is replaced by `createElementsMemo`. `Collection` is now re-exported from `cause-effect` (a different, upstream type).
- **`src/signals/sensor.ts`**: The Le Truc-specific `createSensor` and `SensorEvents` type have been removed, replaced by `createEventsSensor` and the upstream `createSensor` from `cause-effect`.
- **Removed re-exports**: `diff`, `resolve`, `toError`, `toSignal`, `UNSET`, `isAbortError`, `isNumber`, `isRecordOrArray`, `isString`, `isSymbol`, `Computed`, `ComputedCallback`, `DiffResult`, `ResolveResult`, `StoreKeyExistsError`, `StoreKeyRangeError`, `StoreKeyReadonlyError`.

### Fixed

- **`pass()` no longer requires `configurable` property descriptors** on the target element and no longer leaks state on cleanup.
- **`pass()` now warns in dev mode** when a property doesn't exist on the target (likely a typo) or has no Slot (non-Le Truc element), instead of silently doing nothing.
- **`dangerouslySetInnerHTML` script cloning** now copies all functional and security-hardening attributes (`src`, `async`, `defer`, `nomodule`, `crossorigin`, `integrity`, `referrerpolicy`, `fetchpriority`) instead of only `type`. External scripts with `src` no longer become empty inline scripts.
- **`createEventsSensor` now reacts to collection changes**: For `Memo`-backed element collections, `getTarget()` reads the current elements on each event instead of a stale snapshot captured at sensor creation time. Static single-element targets use a fast path with no array overhead.
- **Dependency resolution no longer swallows errors silently**: `DependencyTimeoutError` is now logged via `console.warn` in dev mode. Previously, the `.catch` handler discarded all errors without any output.
- **Dependency resolution filters out already-defined components**: A microtask defer before `Promise.race` filters out components that were defined synchronously after queries ran (e.g. co-bundled components), avoiding unnecessary waits.
- **Dependency timeout increased from 50ms to 200ms**: Now that structural (CSS-only) custom elements and co-bundled components are filtered out, the timeout only applies to genuinely pending async dependencies and gives them a more realistic window.
- **`module-dialog` effect cleanup** no longer resets `host.open` to `false`, which was causing all dialog tests to fail.
- **`form-listbox` keyboard navigation** now uses direct `querySelectorAll` instead of a watched `Memo` that never activated its `MutationObserver` outside reactive contexts.

## 0.15.0

Baseline version. Changes before this version are not documented.
