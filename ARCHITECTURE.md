# Architecture

Le Truc is a reactive custom elements library. This document provides the mental model behind the architecture. For implementation details, see the source code and the referenced ADRs.

The single external dependency is `@zeix/cause-effect`, which provides the reactive primitives (see [ADR 0001](adr/0001-use-cause-effect-as-reactive-primitive-layer.md)).

## Component Model

**Component** instances are defined using the factory form (see [ADR 0002](adr/0002-factory-form-over-builder-pattern.md)):

```ts
defineComponent('my-element', ({ expose, first, watch }) => {
  const input = first('input')
  expose({ value: input.value })
  watch('value', v => { /* ... */ })
})
```

`watch()` and the other factory context helpers register into an ambient per-instance collector when called (see [ADR 0018](adr/0018-implicit-effect-collection-via-ambient-context.md)). The factory does not need to `return` anything. Explicit `return` of a `FactoryResult` array still works but is deprecated (see [ADR 0007](adr/0007-effect-descriptors-with-deferred-activation.md), superseded).

### Lifecycle

- **`connectedCallback`**: Queries DOM, creates signals from parsers, runs the factory (collecting effect descriptors into the ambient collector as `watch`/`on`/`pass`/`each`/`provideContexts` are called), waits for child element definitions, then activates effects in a scope
- **`disconnectedCallback`**: Tears down all effects and event listeners via the scope cleanup

### Signals and Properties

Properties are backed by signals from `@zeix/cause-effect`. The `#setAccessor` creates the appropriate signal based on the initializer:
- Already a `Signal` → used directly
- A function → wrapped in `deriveCell` (read-only)
- Anything else → wrapped in `createState` (read-write)

Mutable signals are wrapped in a `Slot` to enable signal swapping for `pass()` (see [ADR 0004](adr/0004-slot-based-signal-swapping-for-inter-component-binding.md)).

## Reactive System

### Effect Descriptors

`watch()`, `on()`, `pass()`, `each()`, `reconcile()`, and `provideContexts()` produce effect descriptors (thunks). Descriptors activate after dependency resolution, so child components are defined before effects run.

Each helper pushes its descriptor into an ambient collector instead of relying on the factory to `return` it (see [ADR 0018](adr/0018-implicit-effect-collection-via-ambient-context.md), superseding [ADR 0007](adr/0007-effect-descriptors-with-deferred-activation.md)):

- Each component instance has a closure-scoped collector, created in `connectedCallback`.
- `each()`'s per-element `mount` callback pushes its own nested collector for the callback's duration, popped in a `try`/`finally`. This supports arbitrarily nested per-element structures such as grids.
- Calling a helper with no active collector — outside synchronous factory or callback execution, for example after an `await` or inside a detached `setTimeout` — throws immediately.

Explicit `return` of a `FactoryResult` array still works but is deprecated. Descriptors from `watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` are already in the collector by the time they're returned, so returning them is redundant, not required. The return value is not discarded: `forEachUnseen()` (in `helpers/reactive.ts`) reconciles it against the collector, deduping by reference, so a hand-authored `EffectDescriptor` that bypasses every helper is still picked up if returned.

To wrap a native API (`IntersectionObserver`, etc.) or a raw cause-effect primitive without a `return`, use `watch(() => true, descriptor)`. `deriveCell(() => true)` has no signal dependencies, so it never reruns. `watch()`'s internal `createEffect()` call self-registers the descriptor's returned cleanup on the active owner.

### DOM Binding Helpers

Binding helpers return either a setter function `(value) => void` or `SingleMatchHandlers<T>` for use with `watch()` — enabling the pattern `watch(reactive, bindText(element))`.

| Helper | Purpose |
|--------|---------|
| `bindAttribute` | Sets/removes attributes with security validation (see [ADR 0009](adr/0009-security-validation-in-bindattribute.md)) |
| `bindClass` | Adds/removes CSS classes |
| `bindText` | Sets text content |
| `bindProperty` | Sets DOM properties |
| `bindState` | Toggles `ElementInternals` custom states via `:state()` |
| `bindStyle` | Sets/removes inline styles |
| `bindVisible` | Controls `hidden` attribute |
| `dangerouslyBindInnerHTML` | Sets innerHTML |

`bindStyle`, `bindAttribute`, `bindClass`, `bindProperty`, and `bindState` additionally accept a `readonly string[]` in place of the single target, targeting several properties/attributes/class tokens/object keys/custom states from one `watch()` handler instead of N separate calls sharing one computed source (see [ADR 0023](adr/0023-map-form-overloads-for-bind-helpers.md)). Implemented for `bindStyle`/`bindAttribute`/`bindClass`/`bindProperty` (LT-029); `bindState`'s map-form overload is tracked as a follow-up (LT-032).

### Event Binding

`on(target, type, handler)` binds events with unified `(event, target)` signature. For `Signal<Element[]>` targets, uses event delegation with fallback to per-element listeners for non-bubbling events. Per-element lifecycles over reactive element collections — `each()` and `pass()` with a `Signal<Element[]>` target, and the non-bubbling `on()` fallback over `Signal<Element[]>` — share the internal `keyedScopes` helper, which keys scopes by element identity so collection changes only mount entering elements and dispose leaving ones, leaving survivors untouched (see [ADR 0014](adr/0014-keyed-per-element-scopes-for-memo-collections.md)).

### List Reconciliation

`reconcile(container, template, source, bindItem)` syncs a keyed reactive data source (`MutableList<T>` or `DerivedList<T>` from cause-effect; the deprecated `List`/`Collection` aliases remain valid sources) to a container's children. This is Le Truc's only data-driven DOM creation (see [ADR 0017](adr/0017-keyed-template-clone-reconciliation-for-lists.md)).

`reconcile()` is the ownership complement of `each()`:
- `each()` enhances DOM the component doesn't own — DOM-driven, keyed by element identity.
- `reconcile()` owns the container's children — data-driven, keyed by the source's string keys.

On each run:
- Entering keys clone the `<template>`'s single root element (`InvalidTemplateError` if the template doesn't have exactly one).
- Leaving keys dispose their scope and are removed.
- Survivors are always reused and moved with `insertBefore()`.

The first run adopts server-rendered children that carry `data-key`. Children carrying `data-unreconciled` are exempt from reconciliation entirely — this is a public SSR contract.

Per-item bindings mount via `bindItem` in root-keyed scopes, reusing the `keyedScopes` ownership discipline (ADR 0014). The driving effect tracks structural changes (source keys) only.

**`bindItem` has collector parity with `each()`'s callback.** Both run inside an ambient effect-descriptor collector:

- The callback is wrapped in `withCollector(collected, ...)`.
- `activateResult(collected)` activates every descriptor the helpers pushed.
- Any returned `Cleanup` is captured by the per-item `createScope`.

So `watch()`, `on()`, `pass()`, and `provideContexts()` are all usable inside `bindItem`, exactly as inside `each()`'s callback. Per-item reactivity does not require a raw `createEffect`, and per-item events do not require container-level delegation.

`bindItem` and `each()`'s callback also receive a scoped `first` as their last parameter — `query()` (see "Query System" below) pre-bound to the item's root element instead of an explicit root argument (see [ADR 0021](adr/0021-root-parameterized-query-and-queryall.md)). It is named `first`, not `query`, matching host-level `first()`'s pre-bound, one-off shape; naming it `query` would shadow a same-scope standalone `query` import in components that need both. It does not return a `Signal` and does not defer for undefined custom elements: item subtrees are cloned once and static, and no dependency-resolution mechanism exists for a single item mid-reconciliation. An existing, not-yet-upgraded custom element inside an item still surfaces normally through the host-level `first`/`all` if the factory queries it there.

Collected descriptors activate against the per-item `{ root: true }` scope, not the driving structural effect. Item-level `watch(item, …)` therefore does not make the structural effect depend on item signals.

Unlike `each()`, `reconcile()` does not apply `forEachUnseen` to the return value: the return is a teardown, not a descriptor.

## Query System

### `first(selector)` / `all(selector)`

- `first()`: Returns single element or throws `MissingElementError` if required
- `all()`: Returns `Signal<Element[]>` with lazy `MutationObserver` (see [ADR 0006](adr/0006-lazy-mutationobserver-for-all-collections.md)); a malformed selector throws `InvalidSelectorError` immediately instead of stalling the observer

Both collect undefined custom element dependencies for `resolveDependencies()`.

### `query(root, selector, required?)` / `queryAll(root, selector, required?)`

Standalone, root-parameterized siblings of `first`/`all` (see [ADR 0021](adr/0021-root-parameterized-query-and-queryall.md)) — same selector-to-type inference and `MissingElementError`-throwing/optional behavior, applied to an explicit `root` instead of a closed-over host. `queryAll()` returns a plain array, not a `Signal` — no `MutationObserver`, one-shot only. Neither collects dependencies for `resolveDependencies()`.

`first()`/`all()` are implemented as `query`/`queryAll` bound to `host.shadowRoot ?? host`, plus the dependency-collection step. `reconcile()`'s `bindItem` and `each()`'s callback receive `query` pre-bound to the item's root element as their scoped lookup, exposed under the name `first` (see "List Reconciliation" above) — there is no separate per-item implementation.

### Dependency Resolution

Waits for child custom elements to be defined via `customElements.whenDefined()` with 200ms timeout. On timeout, logs error but proceeds — effects run even if dependencies aren't ready.

### Compile-Time Type Inference

Selector strings infer correct `HTMLElement` subtypes at compile time (e.g., `first('input')` → `HTMLInputElement`).

## Data Flow

### Parsers

Parsers transform HTML attribute strings to typed values (see [ADR 0005](adr/0005-branded-parsers-and-methods-with-symbol-based-branding.md)). By default, they are called once at connect time with `getAttribute(key)` (see [ADR 0003](adr/0003-attributes-drive-state-at-connect-time-only.md)). The `observedAttributes()` extension (`src/extensions/attributes.ts`) is an opt-in escape hatch: it registers `observedAttributes`/`attributeChangedCallback` and re-runs the retained `Parser` for named props on each attribute mutation after connect.

### Context Protocol

Implements the [Community Protocol for Context](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md) (see [ADR 0008](adr/0008-community-protocol-for-context.md)):

- `provideContexts([...])`: provider side. Installs a `context-request` listener. A throwing property getter is caught and degrades to `undefined` (logged in `DEV_MODE`) instead of throwing inside the consumer's `Slot`.
- `requestContext(context, fallback)`: consumer side. Dispatches `ContextRequestEvent` and returns a `Signal<T>` backed by a `Slot` — the same primitive `pass()` uses for overridable backing signals.

A provider can upgrade after the consumer's synchronous dispatch — for example if its `customElements.define()` runs later in the bundle, or its `provideContexts` listener hasn't activated yet. Two re-dispatches catch this case: one on a microtask, one after the 200 ms dependency-resolution window. Each re-dispatch lets the `Slot` swap its delegate from the fallback `State` to a read-only `Signal` of the provider's getter, switching the value reactively with no consumer code change.

Once a provider answers, the consumer retains its value for the lifetime of the connection. Providers are stable single sources of truth that update values, not entities to be removed or swapped — disconnecting a provider does not revert the consumer to `fallback` (see [ADR 0015](adr/0015-late-provider-retry-in-requestcontext.md)).

### Inter-Component Signal Sharing (Pass)

`pass(target, props)` swaps Slot-backed signals for zero-overhead live `Signal` sharing between Le Truc `Component` instances. Every entry in `props` is a declared intent to bind a live signal.

`pass()` throws `InvalidPassPropertyError`, naming every failing prop, if a prop:
- Doesn't exist on the target
- Can't be resolved to a signal
- Isn't Slot-backed — the target is a non-Le-Truc custom element, or the prop is read-only or computed

Validation runs eagerly, before any signal is swapped, so a failure never leaves a partial bind (see [ADR 0011](adr/0011-throw-on-pass-binding-failure.md)).

The property-key and bare-writable-signal short forms grant the child unrestricted `.set()` on the parent's signal. They are deprecated in favor of the thunk (read-only) and `{ get, set }` descriptor (mediated writable) forms, and warn in `DEV_MODE` (see [ADR 0012](adr/0012-deprecate-unrestricted-write-short-forms-in-pass.md)).

## Naming Conventions

| Prefix | Layer | Examples |
|--------|-------|----------|
| `define*` | Component definition | `defineComponent`, `defineMethod` |
| `bind*` | DOM binding | `bindText`, `bindAttribute`, `bindClass` |
| `as*` | Parsers | `asBoolean`, `asInteger`, `asString` |
| `create*` | Signals | `createState`, `createEffect`, `createScope` |

Factory context helpers (`watch`, `on`, `pass`, `provideContexts`, `requestContext`, `expose`, `first`, `all`) are plain verbs with no prefix. `query`/`queryAll` are also plain verbs, deliberately distinct from `first`/`all` — standalone exports usable with any root element, not FactoryContext members.

## Security

`bindAttribute()` (via `safeSetAttribute()`) validates URLs and blocks `on*` handlers (see [ADR 0009](adr/0009-security-validation-in-bindattribute.md)).

## Scheduler

`schedule(element, task)` deduplicates high-frequency DOM updates using `requestAnimationFrame`, keyed per element. It is used by `dangerouslyBindInnerHTML`. The sibling `throttle(fn, signal?)` helper — which shares the same single RAF tick — limits passive event handlers in `on()` to one call per animation frame.

## Debug Instrumentation

In `DEV_MODE`, every component gets a reactive `debug: boolean` property (default `false`) for free — no source change, no explicit opt-in — via `debug()`, a `ComponentExtension` `defineComponent()` appends to every component's extensions array unconditionally when `process.env.DEV_MODE === 'true'`. While `debug` is on for an instance, `on()`/`pass()`/`watch()` push an additive companion effect through the same `collect()` chokepoint every effect helper already uses: a permanent `:state(debug)` host indicator that pulses on any firing, presence-only `data-le-truc-on`/`-pass`/`-watch` marking on the target element where attribution is possible (exact for `on()`/`pass()`, and for `watch()` handlers produced by a `bind*` helper; a host-level-only pulse otherwise), and one `console.debug` entry per firing. The author's own effect or listener is never wrapped or modified — instrumentation cannot change app behavior merely by being switched on. Toggling `debug` works via the browser's properties panel or, in `DEV_MODE`, `metaKey`+click on the nearest custom-element ancestor. See [ADR 0022](adr/0022-debug-extension-for-visual-and-console-instrumentation.md).

## Ecosystem Tooling

### Custom Elements Manifest

Le Truc example components are analysed by `@custom-elements-manifest/analyzer` using the `@zeix/cem-plugin-le-truc` plugin (see [ADR 0013](adr/0013-cem-plugin-for-le-truc-factory-pattern.md)). The plugin adapts Le Truc's factory pattern to the standard CEM ecosystem.

The generated `custom-elements.json` (repo root, referenced via `"customElements"` in `package.json`, gitignored) enables two **optional** tooling features — neither is required to build, test, or contribute to Le Truc:
- **`cem lsp`**: Editor autocomplete, hover docs, and diagnostics in HTML templates (VS Code, Zed) — requires `@pwrs/cem` installed globally (see CONTRIBUTING.md); not a project dependency.
- **`cem mcp`**: AI-native component context for coding agents (Claude Code, etc.) — opt-in via a gitignored `.mcp.json` per the CONTRIBUTING.md instructions

#### What the plugin extracts

| CEM field | Source |
|---|---|
| `tagName` | First string argument of `defineComponent(tagName, …)` |
| `name` | PascalCase from tagName (`basic-counter` → `BasicCounter`) |
| `description` | JSDoc above the `export default defineComponent(…)` |
| `members` | Properties of `Props` type via TypeScript type checker — always the source of truth |
| `attributes` | Properties in `expose({})` whose initializer is a call to an `as*` Parser from `@zeix/le-truc` (imported by package name **or** by relative path into the package root — resolved against the owning `package.json`) |
| `slots`, `events`, `cssParts`, `cssProperties` | `@slot`, `@fires`, `@csspart`, `@cssprop` JSDoc tags on the export |

#### JSDoc annotation contract

```typescript
/**
 * Component description.
 * @slot - Default slot description
 * @fires event-name - Fired when …
 */
export default defineComponent<MyProps>('my-element', …)
```

Property descriptions go on the `Props` type:

```typescript
export type MyProps = {
  /** Property description. Read from the `value` attribute at connect time. */
  value: string
}
```

#### Generation

Run `bun run build:cem` to generate `custom-elements.json`. The script runs `cem analyze` using `custom-elements-manifest.config.mjs` targeting `examples/**/*.ts` (test files excluded). The manifest is gitignored — it is a local build artifact, not committed.
