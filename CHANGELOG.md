# Changelog

## 2.0.0-next

### Added

- **`FactoryContext<P>` type**: New context object passed to the factory function, containing element query helpers (`first`, `all`), the `host` element, and factory helpers (`expose`, `watch`, `on`, `pass`, `provideContexts`, `requestContext`).
- **`EffectDescriptor` type**: Deferred effect — a thunk `() => MaybeCleanup` that runs inside a reactive scope after all dependencies are resolved. Replaces the old `Effect<P, E>` type.
- **`FactoryResult` type**: Return type of the factory function — a flat array of `EffectDescriptor | false | undefined`, enabling the `element && descriptor()` pattern for conditional effects.
- **`SingleMatchHandlers<T>` type** (re-exported from `@zeix/cause-effect`): Match-branch handlers with `ok`, `err`, `nil`, and `stale` properties, accepted by `watch()` and DOM binding helpers. `ok` receives the resolved value directly; `err` receives a single `Error`. `stale` fires when the signal has a retained value and a `Task` is re-executing (`isPending() === true`); omitting it falls back to `ok`. Routing precedence: `nil` > `err` > `stale` > `ok`. All handler return types are `MaybePromise<MaybeCleanup>`, enabling async handlers for fire-and-forget side effects such as fetch calls or analytics.
- **`MaybePromise<T>` type** (re-exported from `@zeix/cause-effect`): `T | Promise<T>` — the return type of async-capable handlers in `SingleMatchHandlers<T>`.
- **`PassedProps<P, Q>` type**: Props object for `pass()` — maps child component property names to `Reactive<Q[K], P>` values.
- **DOM binding helpers** in a new `src/helpers.ts` module, each usable as a `watch()` handler:
  - `bindText(element, preserveComments?)` — sets text content
  - `bindProperty(element, key)` — sets a DOM property
  - `bindClass<T = boolean>(element, token)` — toggles a class; generic `T` allows non-boolean reactive values without a transform function
  - `bindVisible<T = boolean>(element)` — controls visibility via `el.hidden = !value`; generic `T` allows non-boolean reactive values
  - `bindAttribute(element, name, allowUnsafe?)` — returns `WatchHandlers<string | boolean>` for attribute management; boolean values use `toggleAttribute`
  - `bindStyle(element, prop)` — returns `WatchHandlers<string>` for inline style; nil value calls `removeProperty`, restoring the CSS cascade
  - `dangerouslyBindInnerHTML(element, options?)` — returns `WatchHandlers<string>` for innerHTML with optional shadow DOM and script re-execution
- **`each(memo, callback)` helper**: Creates per-element reactive effects from a `Memo<E[]>`. When elements enter the collection their effects are activated inside a per-element `createScope`; when they leave the scope is disposed. The callback receives a single element and returns a `FactoryResult` array or a single `EffectDescriptor`. Returned as an `EffectDescriptor` for inclusion in the factory return array.
- **`OnEventHandler<P, Evt, E>` type** exported from `src/events.ts`: Handler signature for `on()` — receives `(event, element)` and may return `{ prop: value }` to batch-update host properties, `Promise<void>` for fire-and-forget side effects, or `void`.
- **`asDate(fallback?)` parser**: New `Parser<string>` factory with a simplified signature — no longer requires a UI context parameter.
- **`asClampedInteger(min?, max?)` parser**: Parser for clamped integer values; returns `min` (default `0`) when the attribute is absent or the parsed value is out of range.
- **`throttle(fn, signal?)` utility**: New exported function in `src/scheduler.ts`. Wraps any function to execute at most once per animation frame, always using the latest arguments. Shares the same RAF tick as `schedule()`. The returned function has a `.cancel()` method that discards any pending invocation. Accepts an optional `AbortSignal` — when the signal fires, the pending invocation is cancelled automatically.

### Changed

- **Passive event listeners throttled at the input level**: `on()` now wraps passive event listeners (scroll, resize, wheel, touch events) with `throttle()` rather than deferring the signal update with `schedule()`. The handler runs at most once per animation frame with the latest event, preventing unnecessary churn in the signal graph between frames.
- **`on()` handler may return `Promise<void>`**: Returning a Promise from an `on()` handler is now explicitly supported for fire-and-forget side effects (analytics, fetch-and-forget, etc.). The Promise is not awaited and its resolved value cannot update host properties. For async state updates, use a trigger-state + `Task`.
- **`defineComponent()` API redesigned with a factory form**: The signature changed from `defineComponent<P, U>(name, props, select, setup)` to `defineComponent<P>(name, factory)`. This is a **breaking change** — the only way to define components is now the factory form. The factory receives a `FactoryContext<P>` and returns a flat `FactoryResult` array of `EffectDescriptor`s.
- **Reactive properties declared via `expose()` inside the factory**: The `props` parameter and the `select` query builder are removed. Components call `context.expose(props)` at connect time to declare reactive properties, enabling per-instance initialization.
- **`Parser<T>` signature simplified**: Parsers no longer receive the element or UI object. The signature is now `(value: string | null | undefined) => T`. Existing parsers using the old two-argument form must be migrated to `asParser()`.
- **`Reactive<T>` type simplified**: Removed the element type parameter; thunks are now `() => T | Promise<T> | null | undefined` instead of `(target: E) => T | null | undefined`.
- **Effect factories replaced by `watch()`, `on()`, `pass()` helpers**: The individual effect factory functions (`setAttribute`, `toggleClass`, `setProperty`, `setText`, etc.) are replaced by the general-purpose `watch(source, handler)` helper combined with the DOM binding helpers above.
- **`on()` redesigned as a factory helper**: Accepts a single element or `Memo<E[]>` target and typed event names. Handlers receive `(event, element)` and may return `{ prop: value }` to batch-update host properties, `Promise<void>` for fire-and-forget side effects, or `void`. For `Memo<E[]>` targets, uses event delegation (one listener on the shadow root or host); non-bubbling events (`focus`, `blur`, `scroll`, `mouseenter`, `mouseleave`, etc.) fall back to per-element listeners with per-element lifecycle — a DEV_MODE warning is logged pointing toward `each()` + `on()`.
- **`pass()` redesigned as a factory helper**: `pass(target, props)` returns an `EffectDescriptor` and works for both single elements and `Memo<E[]>` targets.
- **`provideContexts()` and `requestContext()` are now `FactoryContext` methods**: Instantiated via `makeProvideContexts()` / `makeRequestContext()` bound to the host element. `provideContexts([...])` returns an `EffectDescriptor` to include in the return array.
- **`getHelpers()` replaced by `makeElementQueries()`**: Returns a tuple `[ElementQueries, (run: () => void) => void]`; the `UI` type is no longer exported.
- **`METHOD_BRAND` constant now exported**: Enables explicit branding checks for method producers; `isMethodProducer()` no longer falls back to `isFunction()`.
- **`@zeix/cause-effect` upgraded to `^1.2.1`**: Adds the `SingleMatchHandlers<T>` type and a single-signal `match(signal, handlers)` overload where `ok` receives the value directly and `err` receives a single `Error` (not an array). Async handlers (`MaybePromise<MaybeCleanup>`) are now supported across all branches; rejections are routed to `err` if provided, otherwise fall back to `console.error`. Adds `stale` to `SingleMatchHandlers<T>` and `MatchHandlers<T>`. Also exports `isSignalOfType<T>()` (replaces deprecated `isObjectOfType()`), `DEEP_EQUALITY`, and `DEFAULT_EQUALITY`; all re-exported from `index.ts`.

### Removed

- **Old 4-parameter `defineComponent()` form** `(name, props, select, setup)`: fully replaced by the 2-parameter factory form.
- **`Effects<P, U>` return type and effect-object pattern**: Setup no longer returns a record keyed by UI element names.
- **Effect factory modules** (`src/effects/attribute.ts`, `class.ts`, `event.ts`, `html.ts`, `property.ts`, `style.ts`, `text.ts`, `pass.ts`): all removed; functionality is provided by `watch()` + binding helpers.
- **`Effect<P, E>`, `ElementEffects<P, E>`, `ElementUpdater<E, T>` types**: replaced by `EffectDescriptor`.
- **`Reader<T, H>`, `LooseReader<T>`, `Fallback<T>`, `ParserOrFallback<T>` types and `isReader()`, `read()` functions**: removed from parsers API.
- **`ComponentSetup<P, U>`, `ComponentUI<P, U>`, `Component<P>` types**: no longer needed with the factory form.
- **`InvalidEffectsError`, `InvalidUIKeyError`, `InvalidPropertyNameError` error classes**: removed.
- **`UI` type and `runEffects()` public export**: effects are now activated via descriptors inside a scope created during dependency resolution.
- **`createEventsSensor(element, init, events)` function**: removed. Use `createState(init)` + `expose({ prop: state.get })` + `on(element, 'eventType', () => { state.set(newValue) })` instead. For advanced use cases requiring `Sensor` semantics, `createSensor` is still re-exported from `@zeix/cause-effect`.
- **`SensorEventHandler<T, Evt, E>` and `EventHandlers<T, E>` types**: removed along with `createEventsSensor`.

## 1.0.1

### Changed

- **`@zeix/cause-effect` upgraded from `^1.0.0` to `^1.0.2`**: Documentation and JSDoc corrections across `Sensor`, `Memo`, `Store`, `List`, `Collection`, and utility types. New `List.replace(key, value)` method updates the value of an existing item in place, propagating to all subscribers regardless of how they subscribed. No breaking changes.
- **TypeScript peer dependency broadened to `>=5.8.0`**: Le Truc now supports TypeScript 5.8 through 6 and beyond. The `@types/bun` dev dependency has been replaced with `bun-types`, and `"types": ["bun-types"]` has been added to `tsconfig.json` to fix module resolution under TypeScript 6.

### Fixed

- **`DEV_MODE` no longer throws a `ReferenceError` when bundled from source without `--define`**: `process.env.DEV_MODE` is now guarded with `typeof process !== 'undefined'`, so bundlers that consume `index.ts` directly (via the `module` field) get `false` at runtime rather than crashing. Bundlers that do define `process.env.DEV_MODE=false` still tree-shake the dead code as before.

### Added

- **Five Claude Code skills for structured AI assistance**: `le-truc` (component authoring guidance with progressive disclosure), `le-truc-dev` (library internals and API development), `docs-server-dev` (docs build pipeline and Markdoc), `tech-writer` (keeping docs in sync with source), and `changelog-keeper` (maintaining CHANGELOG.md). Each skill ships with curated references and workflow prompts under `skills/<name>/`.

## 1.0.0

### Changed

- **`@zeix/cause-effect` upgraded from `^0.18.5` to `^1.0.0`**.
- **`UI` type now includes `| undefined` in its index signature**: `type UI = Record<string, Element | Memo<Element[]> | undefined>`. This is a breaking change for TypeScript consumers who access component UI values without narrowing — index access on a `UI`-typed object now yields `Element | Memo<Element[]> | undefined` rather than `Element | Memo<Element[]>`. Component UI types with optional elements should declare them as `prop?: ElementType | undefined` (rather than `prop?: ElementType`) to satisfy `exactOptionalPropertyTypes`.

## 0.16.3

### Added

- **New re-exports from `@zeix/cause-effect`**: `createSignal`, `unown`, `untrack`, `isObjectOfType`, `SKIP_EQUALITY`, and error classes `ReadonlySignalError`, `RequiredOwnerError`, `UnsetSignalValueError` — previously omitted from Le Truc's public API surface.

### Changed

- **`@zeix/cause-effect` upgraded to `0.18.5`**: Adds `unown()` and fixes a scope disposal bug in components connected inside re-runnable effects (see Fixed below).
- **`form-checkbox`, `form-radiogroup`, and `form-spinbutton` examples updated**: All three examples now support controlled component usage, accepting externally managed state in addition to their built-in uncontrolled behaviour.

### Fixed

- **Scope disposal bug when `connectedCallback` fires inside a re-runnable effect**: `createScope` inside a reactive effect (e.g. a list-sync effect) registered its dispose on that effect's cleanup list. When the effect re-ran — for example because a `MutationObserver` fired — it disposed all child scopes including those of already-connected components, silently removing their live event listeners and reactive subscriptions. Fixed by wrapping the `connectedCallback` body in `unown()`, detaching each component's scope from the surrounding effect's ownership tree so effect re-runs no longer dispose it.

## 0.16.2

### Added

- **`asParser(fn)`**: Brands a custom parser with `PARSER_BRAND` so `isParser()` can identify it reliably regardless of `function.length`. Use this for any custom two-argument parser (especially those using default parameters or destructuring).
- **`asMethod(fn)`**: Brands a side-effect initializer with `METHOD_BRAND`, producing a `MethodProducer` that `defineComponent` dispatches explicitly rather than treating as a `Reader`.
- **`isMethodProducer(value)`**: Type guard that checks for `METHOD_BRAND`. Replaces the old implicit `isFunction` fallback for method producers.

### Changed

- **`isParser()` checks `PARSER_BRAND` first**: Falls back to `fn.length >= 2` for backward compatibility, but emits a `console.warn` in `DEV_MODE` when the fallback path is taken. Migrate custom parsers to `asParser()` to silence the warning.
- **`defineComponent` signal dispatch is explicit**: Initialization order is now `Parser → MethodProducer → Reader → static/Signal`. Previously, method producers and readers were both handled by an `isFunction` branch with no distinction.
- **`on()` and `pass()` wrap their body in `createScope()`**: Both effects now own a reactive scope internally. This ensures proper child-effect disposal and signal restoration when the component disconnects, without requiring callers to manage scopes.
- **`pass()` captures and restores the original Slot signal on cleanup**: When the parent disconnects, the child's Slot is restored to the signal it held before `pass()` ran, so the child regains its own independent state after detachment.
- **`pass()` is scoped to Le Truc components only**: The `[Reactive, callback]` two-way binding form has been removed from `PassedProp`. For non-Le Truc custom elements, use `setProperty()` instead.
- **`RESET` sentinel replaced by `undefined`**: `resolveReactive()` now returns `undefined` on error. `updateElement` treats `undefined` the same way it treated `RESET` — restoring the original DOM fallback value.
- **`resolveReactive()` warns on missing property names in `DEV_MODE`**: When a string reactive refers to a property that does not exist on the host, a `console.warn` is emitted. This catches typos for JavaScript consumers not covered by TypeScript's `keyof P` guard.
- **`EventHandler` type is now documented**: JSDoc on `EventHandler` explains both the side-effect-only (`void`) and property-update-shortcut (`{ prop: value }`) return modes. `on()` JSDoc includes `@example` blocks for both forms.

### Fixed

- **`pass()` no longer silently drops bindings on child detach**: The original Slot signal is captured before replacement and restored on cleanup, preventing stale parent signals from persisting in detached children.
- **`pass()` warns in `DEV_MODE` when target property is not Slot-backed**: Emits `console.warn` and skips the binding (instead of silently doing nothing) when `pass()` is used on a non-Le Truc element.
- **`MethodProducer` cleanup correctly composed with effect cleanup**: Cleanup functions returned by method producers are now composed with the surrounding effect cleanup in `defineComponent`, preventing disposal leaks.

## 0.16.1

### Changed

- **`createElementsMemo` mutation filtering**: The `MutationObserver` callback now uses a `couldMatch` helper to filter mutations, only invalidating when added/removed nodes match or contain matches for the selector. This prevents spurious effect re-runs caused by mutations *inside* matched elements (e.g., `innerHTML` changes on option buttons).
- **`createElementsMemo` custom `equals`**: The memo now compares arrays by element identity (`length` + `every`).
- **Effect system simplified**: `runEffects` now uses `createScope()` to own all child effects. Dynamic collections are handled by a single `createEffect()` whose ownership graph automatically disposes per-element effects on re-run. The former `runElementsEffects` and `runElementEffects` helpers have been inlined.

### Removed

- **`runEffects` and `runElementEffects` removed from public API**: These were never intended for userland use and calling them directly could corrupt disposal. `runEffects` remains as internal helper.

### Fixed

- **`innerHTML` on matched elements no longer destroys reactivity**: Setting `innerHTML` on elements matched by `createElementsMemo` (e.g., `button[role="option"]`) previously caused the `MutationObserver` to fire spuriously, re-running and disposing effects without properly re-attaching them. Fixed by combining mutation filtering with ownership-based cleanup.

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
- **`dangerouslyBindInnerHTML` script cloning** now copies all functional and security-hardening attributes (`src`, `async`, `defer`, `nomodule`, `crossorigin`, `integrity`, `referrerpolicy`, `fetchpriority`) instead of only `type`. External scripts with `src` no longer become empty inline scripts.
- **`createEventsSensor` now reacts to collection changes**: For `Memo`-backed element collections, `getTarget()` reads the current elements on each event instead of a stale snapshot captured at sensor creation time. Static single-element targets use a fast path with no array overhead.
- **Dependency resolution no longer swallows errors silently**: `DependencyTimeoutError` is now logged via `console.warn` in dev mode. Previously, the `.catch` handler discarded all errors without any output.
- **Dependency resolution filters out already-defined components**: A microtask defer before `Promise.race` filters out components that were defined synchronously after queries ran (e.g. co-bundled components), avoiding unnecessary waits.
- **Dependency timeout increased from 50ms to 200ms**: Now that structural (CSS-only) custom elements and co-bundled components are filtered out, the timeout only applies to genuinely pending async dependencies and gives them a more realistic window.
- **`module-dialog` effect cleanup** no longer resets `host.open` to `false`, which was causing all dialog tests to fail.
- **`form-listbox` keyboard navigation** now uses direct `querySelectorAll` instead of a watched `Memo` that never activated its `MutationObserver` outside reactive contexts.

## 0.15.0

Baseline version. Changes before this version are not documented.
