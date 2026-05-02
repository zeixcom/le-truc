# Changelog

## [Unreleased]

### Fixed

- **`WatchHandlers` corrected to `SingleMatchHandlers` throughout documentation**: `CLAUDE.md`, `ARCHITECTURE.md`, and all `.claude/skills/` references used `WatchHandlers` — a name from an earlier draft. The type exported from `@zeix/cause-effect` and re-exported by Le Truc is `SingleMatchHandlers<T>`. The documentation now also correctly lists the `stale?` branch, which fires when a `Task` signal is re-computing with a retained value (omitting it falls back to `ok`). Affected files: `CLAUDE.md`, `ARCHITECTURE.md`, `le-truc/references/effects.md`, `le-truc/references/component-model.md`, `le-truc-dev/workflows/implement-feature.md`.
- **`FactoryResult` incorrectly described as "flat array" throughout documentation**: `CLAUDE.md`, `ARCHITECTURE.md`, `le-truc/SKILL.md`, `le-truc/workflows/build.md`, and `le-truc/references/component-model.md` all described the factory return value as a "flat array of effect descriptors". The actual type is `Array<EffectDescriptor | FactoryResult | Falsy>` — nested arrays are recursively flattened by `activateResult()`, and falsy values (`false`, `null`, `undefined`, `''`, `0`) are filtered before activation. The `element && [watch(...)]` pattern depends on this: the inner `[watch(...)]` is a nested `FactoryResult`, not an `EffectDescriptor`. The code has always worked this way; only the documentation was wrong.
- **`SlotDescriptor` added as allowed in `PassedProps`**: `le-truc/references/coordination.md`, `le-truc/references/effects.md` updated to clarify its purpose as bi-directional adapters.
- **`le-truc-dev` `source-map` `effects.ts` exports corrected**: Listed `WatchHandlers` as an export of `src/effects.ts`. The actual exported type names are `WatchHelper` (the bound `watch` function type) and `PassHelper` (the bound `pass` function type).
- **`all()` documented as single-argument in skill files**: `le-truc/references/component-model.md`, `le-truc/references/coordination.md`, and `le-truc-dev/references/cause-effect-integration.md` all showed `all(selector)` with one argument, omitting the optional `required?` second parameter. When `required` is a non-empty string and no elements match the selector at query time, `all()` throws `MissingElementError` — the same guard `first(selector, required?)` already supported and documented. The signatures now correctly read `all(selector, required?)`.
- **`docs-server-dev` `architecture` effects table stale**: `mdMirrorEffect` (outputs `docs/**/*.md` — one parallel Markdown mirror per HTML page) and `llmsManifestEffect` (outputs `docs/llms.txt` — the AI crawler manifest) were missing from the effects table; build orchestration count read 11 instead of 13. The stale claim that "all HTML routes support `Accept: text/markdown`" — a dynamic header approach superseded by the parallel static file system — has been replaced: `mdMirrorEffect` generates static `.md` files served directly at the same path with a `.md` extension, no special route handling needed.

### Changed

- **`changelog-keeper` `adding_entries`**: The git diff command now includes `.claude/skills/` alongside `src/` and `index.ts`. Changes to skills are treated as significant as source code changes — skills govern how code is generated and reviewed. The `entry_style` section now includes guidance on classifying and writing entries for skill changes (Changed/Added/Removed, bold skill name + affected file, describe behavioral difference).
- **`tech-writer` scope extended to `.claude/skills/` and `server/SERVER.md`**: The skill previously covered only `docs-src/pages/`, `README.md`, `ARCHITECTURE.md`, `CLAUDE.md`, and JSDoc in `src/`. It now also owns all skill files under `.claude/skills/` (SKILL.md, references/, workflows/) and `server/SERVER.md`. Two new workflows added: `update-skills.md` (fix inaccurate API signatures, behavior descriptions, or process steps across any skill's reference or workflow files, with explicit cross-skill propagation check) and `update-server-md.md` (update `server/SERVER.md` after dev server or build pipeline changes, with a change-type → section mapping table).

## 2.0.1

### Added

- **`ScopeOptions` and `SlotDescriptor` types re-exported from `@zeix/cause-effect`**: `ScopeOptions` is the options argument to `createScope()` (e.g. `{ root: true }` to create an unowned root scope). `SlotDescriptor<T>` is the `{ get: () => T; set?: (value: T) => void }` shape exposed by Slot signals and now accepted directly by `pass()`.

### Changed

- **`@zeix/cause-effect` upgraded to `^1.3.2`** from `^1.2.1`: adds `ScopeOptions` for root-scope creation, `SlotDescriptor<T>` for the Slot getter/setter descriptor shape, and fixes stale reactive properties after a component reconnects to the DOM.
- **`DangerouslySetInnerHTMLOptions` renamed to `DangerouslyBindInnerHTMLOptions`**: The old name is no longer exported. Update all import sites that reference the type by name. The rename aligns with the `dangerouslyBindInnerHTML` function name and the broader `bind*` helper naming convention. **Breaking change for TypeScript consumers who import the type explicitly.**
- **`PassedProps<P, Q>` accepts `SlotDescriptor<Q[K] & {}>` values**: In addition to `Reactive<Q[K], P>`, each entry in the map passed to `pass()` may now be a raw `SlotDescriptor` — a `{ get, set? }` object. `toSignal()` detects descriptor objects (present `get`, absent `Symbol.toStringTag`) and passes them through without wrapping, so callers can forward a Slot signal's own descriptor directly.

### Fixed

- **Scope disposal bug when `connectedCallback` fires inside a re-runnable effect (regression from v0.16.3)**: The v2.0 rewrite dropped the `unown()` guard that had been present since v0.16.3. As a result, `createScope(() => activateResult(result))` in `connectedCallback` registered the component scope as a child of whatever `createEffect` was running when the element was inserted into the DOM — typically a `watch(list.keys(), …)` DOM-reconciliation effect. When that effect re-ran (e.g. because a second item was added to the list), `runCleanup` disposed all owned scopes, silently killing every `createEffect`-backed `watch` inside the newly-connected component. Event listeners added by `on()` survived (their cleanup is not auto-registered via `createEffect`), which masked the bug: clicks could still update list state through the slot setter, but the component's own reactive effects no longer responded to signal changes. Fixed by restoring `createScope(…, { root: true })` so the component scope is never owned by an outer reactive context and `disconnectedCallback` remains the sole lifecycle authority.
- **Double initialization guard in `connectedCallback`**: The factory function is now called only once per element instance. A private `#initialized` flag and `#setup` cache are set after the first `connectedCallback` run. Subsequent calls (DOM re-insertion) skip the factory entirely and re-activate the cached `FactoryResult` directly, preventing duplicate `expose()` calls and redundant reactive-property and accessor creation on reconnect.
- **`on()` event listeners now owned by a child `createScope()`**: Previously, `on()` returned a raw cleanup function from the `EffectDescriptor` thunk; cleanup was composed into the surrounding reactive scope only if the descriptor was not inside a conditional expression. Both delegation-style (`Memo<E[]>`) and direct single-element `on()` calls now wrap listener registration in `createScope()`, so the listener's cleanup is registered in the reactive ownership graph unconditionally. Listeners are guaranteed to be removed when the component's root scope disposes on `disconnectedCallback`.

## 2.0.0

### Added

- **`FactoryContext<P>` type**: Context object passed to the factory function. Contains element query helpers (`first`, `all`), the `host` element, and effect helpers (`expose`, `watch`, `on`, `pass`, `provideContexts`, `requestContext`).
- **`EffectDescriptor` type**: Deferred effect — a thunk `() => MaybeCleanup` activated inside a reactive scope after dependency resolution. Replaces `Effect<P, E>`.
- **`FactoryResult` type**: Return type of the factory function — a (possibly nested) array of `EffectDescriptor` values and falsy guards, enabling the `element && [watch(...)]` conditional pattern.
- **`PassedProps<P, Q>` type**: Second argument to `pass()` — maps child component property names to reactive values from the parent.
- **`SingleMatchHandlers<T>` type** (re-exported from `@zeix/cause-effect`): Match-branch handlers accepted by `watch()` and the `bindAttribute`, `bindStyle`, and `dangerouslyBindInnerHTML` helpers. `ok` receives the resolved value; `err` receives a single `Error`; `stale` fires when a `Task` is re-executing with a retained value (omitting it falls back to `ok`). Routing precedence: `nil` > `err` > `stale` > `ok`. All handler return types are `MaybePromise<MaybeCleanup>`.
- **`MaybePromise<T>` type** (re-exported from `@zeix/cause-effect`): `T | Promise<T>`.
- **DOM binding helpers**, each used as the second argument to `watch()`:
  - `bindText(element, preserveComments?)` — sets text content
  - `bindProperty(element, key)` — sets a DOM property
  - `bindClass<T = boolean>(element, token)` — toggles a CSS class token; generic `T` allows non-boolean reactive values without a transform
  - `bindVisible<T = boolean>(element)` — controls visibility via `el.hidden = !value`; `true` = visible
  - `bindAttribute(element, name, allowUnsafe?)` — returns `SingleMatchHandlers<string | boolean>`; boolean values use `toggleAttribute`; nil removes the attribute
  - `bindStyle(element, prop)` — returns `SingleMatchHandlers<string>`; nil removes the inline style, restoring the CSS cascade
  - `dangerouslyBindInnerHTML(element, options?)` — returns `SingleMatchHandlers<string>` for innerHTML with optional shadow DOM and script re-execution
- **`each(memo, callback)` function**: Creates per-element reactive effects from a `Memo<E[]>`. Effects for entering elements are activated in a per-element scope; leaving elements dispose their scope. The callback receives a single element and returns a `FactoryResult` or a single `EffectDescriptor`. Not part of `FactoryContext` — import directly alongside `defineComponent`.
- **`OnEventHandler<P, Evt, E>` type**: Handler signature for `on()` — receives `(event, element)` and may return `{ prop: value }` to batch-update host properties, `Promise<void>` for fire-and-forget side effects, or `void`.
- **`asClampedInteger(min?, max?)` parser**: Clamps a parsed integer to `[min, max]`; returns `min` (default `0`) when the attribute is absent or the value is out of range.
- **`throttle(fn, signal?)` utility**: Wraps any function to execute at most once per animation frame, always using the latest arguments. The returned function has a `.cancel()` method. Accepts an optional `AbortSignal` — when it fires, any pending invocation is cancelled.
- **`escapeHTML(text)`, `safeSetAttribute(element, name, value)`, `setTextPreservingComments(element, text)` utilities**: Exported for use in component code that manipulates the DOM directly. `safeSetAttribute` validates URL protocols and blocks `on*` attribute names.

### Changed

- **`defineComponent()` signature changed to a 2-parameter factory form**: The old 4-parameter signature `(name, props, select, setup)` is removed. The only form is now `defineComponent<P>(name, factory)`, where the factory receives a `FactoryContext<P>` and returns a `FactoryResult` array of `EffectDescriptor`s. **Breaking change** — all components must be rewritten.
- **Reactive properties declared via `expose()` inside the factory**: `expose(props)` is called once inside the factory at connect time to initialize reactive properties. Replaces the `props` parameter and `select` query builder from the old form.
- **`Parser<T>` signature simplified**: Parsers no longer receive the element or UI object. The signature is now `(value: string | null | undefined) => T`. Migrate existing 2-argument parsers to the new signature and brand with `asParser()`.
- **`Reactive<T>` type simplified**: Element type parameter removed; thunks are now `() => T | Promise<T> | null | undefined` instead of `(target: E) => T | null | undefined`.
- **Effect factory functions replaced by `watch()` + binding helpers**: `setAttribute`, `toggleClass`, `setProperty`, `setText`, and other v1 effect factories are removed. Use `watch(source, bindText(el))`, `watch(source, bindAttribute(el, 'name'))`, etc. instead.
- **`on()` redesigned as a factory context helper**: Takes an explicit single element or `Memo<E[]>` as the first argument. Handlers receive `(event, element)` — typed to the matched element, eliminating `event.target` casting. Returning `{ prop: value }` batch-applies updates to host properties synchronously; `Promise<void>` is supported for fire-and-forget side effects. For `Memo<E[]>` targets, uses event delegation; non-bubbling events (`focus`, `blur`, `scroll`, `mouseenter`, `mouseleave`, etc.) fall back to per-element listeners with a DEV_MODE warning pointing toward `each()` + `on()`. Passive events (`scroll`, `resize`, `wheel`, `touchstart`, `touchmove`) are throttled to one call per animation frame.
- **`pass()` redesigned as a factory context helper**: `pass(target, props)` accepts a single element or `Memo<E[]>` and returns an `EffectDescriptor`. For `Memo<E[]>` targets, manages per-element signal swap lifecycle automatically.
- **`provideContexts()` and `requestContext()` are factory context helpers**: Both are bound to the host element and called directly from the factory. `provideContexts([...])` returns an `EffectDescriptor` to include in the return array.
- **`@zeix/cause-effect` upgraded to `^1.2.1`**: Adds `SingleMatchHandlers<T>` with a single-signal `match(signal, handlers)` overload (`ok` receives the value directly, `err` a single `Error`), async handlers (`MaybePromise<MaybeCleanup>`) across all branches, and the `stale` branch for `Task` signals. Also exports `isSignalOfType<T>()` (replaces deprecated `isObjectOfType()`), `DEEP_EQUALITY`, and `DEFAULT_EQUALITY`; all re-exported from Le Truc's `index.ts`.

### Fixed

- **`extractAttributes` ReDoS**: Replaced `/\[[^\]]*\]/g` with a linear O(n) depth-counter scan, eliminating O(n²) backtracking on selectors containing many `[` without a closing `]`. Also fixed attribute name extraction to split on `]` before stripping non-alphanumeric characters, preventing characters after `]` (e.g. `#id` in `.nav[aria-expanded]#id`) from leaking into the extracted name.

### Removed

- **Old 4-parameter `defineComponent()` form** `(name, props, select, setup)` — fully replaced by the factory form.
- **`Effects<P, U>` return type and the effect-object pattern** — setup no longer returns a record keyed by UI element names.
- **Effect factory functions** (`setAttribute`, `toggleClass`, `setProperty`, `setText`, etc.) — replaced by `watch()` + `bind*` helpers.
- **`Effect<P, E>`, `ElementEffects<P, E>`, `ElementUpdater<E, T>` types** — replaced by `EffectDescriptor`.
- **`Reader<T, H>`, `LooseReader<T>`, `Fallback<T>`, `ParserOrFallback<T>` types and `isReader()`, `read()` functions** — removed from the parsers API.
- **`ComponentSetup<P, U>`, `ComponentUI<P, U>`, `Component<P>` types** — no longer needed with the factory form.
- **`InvalidEffectsError` and `InvalidUIKeyError` error classes** — removed.
- **`UI` type and `runEffects()` export** — removed.
- **`createEventsSensor(element, init, events)` function**: Use `createState(init)` + `expose({ prop: state.get })` + `on(element, 'eventType', () => { state.set(newValue) })` instead. `createSensor` is still re-exported from `@zeix/cause-effect` for advanced use cases.
- **`SensorEventHandler<T, Evt, E>` and `EventHandlers<T, E>` types** — removed along with `createEventsSensor`.

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

- **`createElementsMemo` mutation filtering**: The `MutationObserver` callback now uses a `couldMatch` helper to filter mutations, only invalidating when added/removed nodes match or contain matches for the selector. This prevents spurious effect re-runs caused by mutations _inside_ matched elements (e.g., `innerHTML` changes on option buttons).
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
