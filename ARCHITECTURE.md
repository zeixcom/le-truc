# Architecture

Le Truc is a reactive custom elements library. This document provides the mental model behind the architecture. For implementation details, see the source code and the referenced ADRs.

The single external dependency is `@zeix/cause-effect`, which provides the reactive primitives (see [ADR 0001](adr/0001-use-cause-effect-as-reactive-primitive-layer.md)).

## Component Model

**Component** instances are defined using the factory form (see [ADR 0002](adr/0002-factory-form-over-builder-pattern.md)):

```ts
defineComponent('my-element', ({ expose, first, watch }) => {
  const input = first('input')
  expose({ value: input.value })
  return [watch('value', v => { /* ... */ })]
})
```

### Lifecycle

- **`connectedCallback`**: Queries DOM, creates signals from parsers, collects effect descriptors, waits for child element definitions, then activates effects in a scope
- **`disconnectedCallback`**: Tears down all effects and event listeners via the scope cleanup

### Signals and Properties

Properties are backed by signals from `@zeix/cause-effect`. The `#setAccessor` creates the appropriate signal based on the initializer:
- Already a `Signal` → used directly
- A function → wrapped in `createComputed` (read-only)
- Anything else → wrapped in `createState` (read-write)

Mutable signals are wrapped in a `Slot` to enable signal swapping for `pass()` (see [ADR 0004](adr/0004-slot-based-signal-swapping-for-inter-component-binding.md)).

## Reactive System

### Effect Descriptors

`watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` return effect descriptors (thunks) that are activated after dependency resolution (see [ADR 0007](adr/0007-effect-descriptors-with-deferred-activation.md)). This ensures child components are defined before effects run.

### DOM Binding Helpers

Binding helpers return either a setter function `(value) => void` or `SingleMatchHandlers<T>` for use with `watch()` — enabling the pattern `watch(reactive, bindText(element))`.

| Helper | Purpose |
|--------|---------|
| `bindAttribute` | Sets/removes attributes with security validation (see [ADR 0009](adr/0009-security-validation-in-bindattribute.md)) |
| `bindClass` | Adds/removes CSS classes |
| `bindText` | Sets text content |
| `bindProperty` | Sets DOM properties |
| `bindStyle` | Sets/removes inline styles |
| `bindVisible` | Controls `hidden` attribute |
| `dangerouslyBindInnerHTML` | Sets innerHTML |

### Event Binding

`on(target, type, handler)` binds events with unified `(event, target)` signature. For `Memo<Element[]>` targets, uses event delegation with fallback to per-element listeners for non-bubbling events.

## Query System

### `first(selector)` / `all(selector)`

- `first()`: Returns single element or throws `MissingElementError` if required
- `all()`: Returns `Memo<Element[]>` with lazy `MutationObserver` (see [ADR 0006](adr/0006-lazy-mutationobserver-for-all-collections.md))

Both collect undefined custom element dependencies for `resolveDependencies()`.

### Dependency Resolution

Waits for child custom elements to be defined via `customElements.whenDefined()` with 200ms timeout. On timeout, logs error but proceeds — effects run even if dependencies aren't ready.

### Compile-Time Type Inference

Selector strings infer correct `HTMLElement` subtypes at compile time (e.g., `first('input')` → `HTMLInputElement`).

## Data Flow

### Parsers

Parsers transform HTML attribute strings to typed values (see [ADR 0005](adr/0005-branded-parsers-and-methods-with-symbol-based-branding.md)). They are called once at connect time with `getAttribute(key)`. `static observedAttributes = []` — attributes don't drive reactive updates (see [ADR 0003](adr/0003-attributes-drive-state-at-connect-time-only.md)).

### Context Protocol

Implements the [Community Protocol for Context](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md) (see [ADR 0008](adr/0008-community-protocol-for-context.md)):

- `provideContexts([...])`: Provider side, installs `context-request` listener
- `requestContext(context, fallback)`: Consumer side, dispatches `ContextRequestEvent`, returns `Memo<T>`

### Inter-Component Signal Sharing (Pass)

`pass(target, props)` swaps Slot-backed signals for zero-overhead live **Signal** sharing between Le Truc **Component** instances.

## Naming Conventions

| Prefix | Layer | Examples |
|--------|-------|----------|
| `define*` | Component definition | `defineComponent`, `defineMethod` |
| `bind*` | DOM binding | `bindText`, `bindAttribute`, `bindClass` |
| `as*` | Parsers | `asBoolean`, `asInteger`, `asString` |
| `create*` | Signals | `createState`, `createEffect`, `createScope` |

Factory context helpers (`watch`, `on`, `pass`, `provideContexts`, `requestContext`, `expose`, `first`, `all`) are plain verbs with no prefix.

## Security

`bindAttribute()` (via `safeSetAttribute()`) validates URLs and blocks `on*` handlers (see [ADR 0009](adr/0009-security-validation-in-bindattribute.md)).

## Scheduler

`schedule(element, task)` deduplicates high-frequency DOM updates using `requestAnimationFrame`. Used by `on()` for passive events and `dangerouslyBindInnerHTML`.

## Ecosystem Tooling

### Custom Elements Manifest

Le Truc example components are analysed by `@custom-elements-manifest/analyzer` using the `@zeix/cem-plugin-le-truc` plugin (see [ADR 0010](adr/0010-cem-plugin-for-le-truc-factory-pattern.md)). The plugin bridges the gap between Le Truc's factory pattern and the standard CEM ecosystem.

The generated `custom-elements.json` (repo root, referenced via `"customElements"` in `package.json`) enables:
- **`cem lsp`**: Editor autocomplete, hover docs, and diagnostics in HTML templates (VS Code, Zed)
- **`cem mcp`**: AI-native component context for coding agents (Claude Code, etc.)

#### What the plugin extracts

| CEM field | Source |
|---|---|
| `tagName` | First string argument of `defineComponent(tagName, …)` |
| `name` | PascalCase from tagName (`basic-counter` → `BasicCounter`) |
| `description` | JSDoc above the `export default defineComponent(…)` |
| `members` | Properties of `Props` type via TypeScript type checker — always the source of truth |
| `attributes` | Properties in `expose({})` whose initializer is a call to an `as*` Parser from `@zeix/le-truc` |
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

Run `bun run build:cem` to generate `custom-elements.json`. The script runs `cem analyze` using `custom-elements-manifest.config.mjs` targeting `examples/**/*.ts` (test files excluded).
