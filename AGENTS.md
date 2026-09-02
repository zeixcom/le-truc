# Agent Context — Le Truc

> This file lists things an agent should know about Le Truc that may be surprising, non-obvious, or easy to get wrong. It is not a general introduction — see `ARCHITECTURE.md` for structure and `package.json` for project metadata.

## Factory Form

The factory form is the only way to define components. The factory receives a `FactoryContext` with helpers `{ all, expose, first, host, on, pass, provideContexts, requestContext, watch }`. `expose({ ... })` declares reactive props. Effect helpers self-register in an ambient collector when called — no `return` needed (ADR 0018):

```ts
defineComponent<MyProps>('my-element', ({ expose, first, host, on, watch }) => {
  const input = first('input') as HTMLInputElement
  expose({ value: input.value })
  on(input, 'input', () => ({ value: input.value }))
  watch('value', v => { input.value = v })
})
```

Explicit `return [...]` of a `FactoryResult` (nested arrays flattened, falsy values filtered) still works but is deprecated — prefer the implicit form above. A hand-authored `EffectDescriptor` not produced by `watch`/`on`/`pass`/`each`/`provideContexts` has no dedicated registration helper. Register it via `watch(() => true, descriptor)` or `return` it directly.

## Surprising Behaviors

- **`observedAttributes` support is opt-in — parsers run once by default**: `defineComponent` never registers `observedAttributes` or `attributeChangedCallback` on its own. Parsers passed to `expose()` read the attribute value once at connect time, for server-rendered HTML configuration. Pass the `observedAttributes()` extension to re-run a Parser-backed prop's parser on each attribute mutation after connect. Without it, use event handlers or `watch()` to react to attribute changes.

- **Parser branding is required for reliable detection**: `isParser()` checks only for `PARSER_BRAND`. Always use `asParser()` to create custom parsers — unbranded functions are NOT treated as parsers regardless of their argument count.

- **`Parser<T>` takes the attribute value only**: Signature is `(value: string | null | undefined) => T`. Fallbacks are static values captured in the factory closure.

- **`pass()` is Le Truc–only and replaces signals, not values**: The factory `pass(target, props)` calls `slot.replace(signal)` on the child's internal Slot map — it only works for Le Truc components whose properties are Slot-backed. For any other custom element or plain HTML element, use `watch(source, bindProperty(el, key))` instead. `bindProperty` assigns to the element's public JS setter and works regardless of the child's internal framework. When `pass()` is used, the original signal is captured and restored when the parent disconnects, so the child regains its own independent state after detachment. The property-key (`'value'`) and bare-writable-signal (`someState`) short forms are deprecated: they grant the child unrestricted `.set()` on the parent's signal and warn in `DEV_MODE`. Use `() => host.prop` for read-only access or `{ get, set }` to mediate writes (ADR 0012).

- **`MethodProducer` is branded, not structurally distinguished**: `isMethodProducer()` checks for `METHOD_BRAND`. Always wrap method producer initializers with `defineMethod()` — e.g. `clear`, `add`, `delete`. Unbranded `() => void` functions are wrapped in `deriveCell()` (treated as a `MemoCallback`), not installed as method producers.

- **A hand-authored `EffectDescriptor` silently never cleans up unless wrapped**: `watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` self-register cleanup via their internal `createEffect()`/`createScope()` call (see ARCHITECTURE.md § Effect Descriptors). A raw descriptor (`() => { setup(); return cleanup }`) has no such registration — if returned bare, its cleanup is silently dropped and never runs on disconnect. Wrap it in `watch(() => true, descriptor)` instead.

- **`all()` MutationObserver is lazy**: The observer activates only when the returned `Cell` is read inside a reactive effect. It watches attribute changes implied by the CSS selector (classes, IDs, `[attr]` patterns), not all mutations. The `equals` check is fully respected: if an `innerHTML` mutation doesn't change which elements match the selector, downstream effects do not re-run.

- **`setAttribute` has security validation**: Blocks `on*` event handler attributes and validates URL attributes against a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`). Violations throw a descriptive error — they are never silent.

- **Dependency resolution timeout races with the child's own upgrade**: If a queried custom element isn't defined within 200ms (`DEPENDENCY_TIMEOUT`), a `DependencyTimeoutError` is logged. The parent's effects activate anyway, against a child that may still be `:not(:defined)` — intentional progressive enhancement, not a bug. If a parent effect writes directly to that child's property (e.g. `watch('prop', bindProperty(child, 'prop'))`), the write lands as a plain instance property before upgrade. When the child later upgrades, `#initSignals` skips wrapping any prop already present on the instance in a reactive `Slot` ("explicit DOM value wins"). The property never becomes reactive on the child — its own initializer is silently discarded. Don't write to a timed-out child's properties from a parent effect.

- **`on()` factory handler return value updates host**: If the factory `on(target, type, handler)` handler returns `{ prop: value }`, those updates are applied to the host in a `batch()`. Returning nothing (or `undefined`) is a no-op.

- **Context protocol is the Web Components Community Protocol**: `provideContexts` / `requestContext` implement the [webcomponents-cg context spec](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md). `provideContexts([...])` registers an `EffectDescriptor` automatically. `requestContext(context, fallback)` returns a `Signal<T>` (backed by a `Slot`, the same primitive `pass()` uses) for direct use in `expose()`. If no ancestor answers the initial dispatch, `requestContext` re-dispatches twice: once on a microtask, and once after ~210 ms. This covers providers upgraded later in the same bundle, and providers still waiting on `customElements.whenDefined()`. The `Slot` serves `fallback` until a provider answers, then swaps its delegate to the provider's getter reactively; after ~210 ms with no provider, the fallback is permanent for that connection. Resolution happens once per component lifetime, at first connect — reconnect re-activates cached descriptors but does not re-run the factory, so `requestContext` does not re-dispatch on reconnect.

- **Providers are stable single sources of truth**: they update the *values* they provide, not add or remove themselves at runtime — removing a provider is an anti-pattern; update the value instead. A connected consumer keeps the provider's last value for the life of the connection — removing the provider does not revert it to `fallback`. This keeps a consumer from flickering through `fallback` when it briefly disconnects and reconnects during a DOM move (e.g. drag-and-drop). Give a consumer a `fallback` that accounts for a genuinely absent provider.

- **`undefined` from a reactive source restores original DOM value**: When a reactive resolves to `undefined` (e.g. after an error in a computed thunk, or a missing property), the effect restores the DOM value captured at setup time — not a blank/null state. The `RESET` symbol no longer exists.

- **Event-driven read-only props use `createState` + `on`**: Expose `state.get` (not the full `State`) to make a prop readable but not settable by consumers. Update the value in an `on()` handler. To watch the prop inside the factory, pass the signal directly: `watch(length, bindVisible(clearBtn))`.

- **`expose()` accepts a `{ get, set? }` descriptor for a mediated read/write prop**: `expose({ value: { get: () => …, set: v => … } })` installs the descriptor directly as the property's backing `Slot` — the same mediated form `pass()` accepts, now usable in `expose()` too. Prefer this over a pair of `watch(internalSignal, v => host.prop = …)` / `watch('prop', v => internalSignal.set(…))` calls kept in sync by hand: one drives the other's re-run, so the second needs an equality guard against re-entrant circularity. A descriptor sidesteps that — the getter derives live, the setter writes through, no second signal to keep in sync. Omit `set` for a read-only mediated prop (writes throw `ReadonlySignalError`). See `examples/form/tokenbox/form-tokenbox.ts`.

- **Dev mode enables enhanced diagnostics**: Build with `--define process.env.DEV_MODE='"true"'` (the **string** `"true"` — guards check `process.env.DEV_MODE === 'true'` inline, so a bare boolean does not enable them) for detailed error messages, dependency-timeout warnings, and effect-execution logging. Production builds define the string `"false"`, which constant-folds every dev branch out of the bundle. No per-instance debug flag exists.

- **`bindVisible` is the inverse of `el.hidden`**: `bindVisible(el)` sets `el.hidden = !value`. A value of `true` makes the element visible.

- **`bindAttribute` returns `SingleMatchHandlers`, not a function**: Use as `watch('prop', bindAttribute(el, 'name'))` — `watch` accepts both a plain function and a `SingleMatchHandlers` object.

- **`bindAttribute` boolean dispatch**: When the reactive value is boolean, `toggleAttribute` is called — the attribute is added (without value) when `true` and removed when `false`. Do not pass boolean for attributes that require a string value.

- **`bindStyle` nil path removes the inline style**: When the reactive is nil, `el.style.removeProperty(prop)` is called, restoring whatever value the CSS cascade provides. Setting the reactive back to a string re-applies the inline style.

- **`stale` in `watch` only fires for `Task` signals with a retained value**: Routing precedence is `nil` > `err` > `stale` > `ok`. `stale` fires when the signal has a retained value AND `isPending(signal)` — never for `State` or `Memo`. Without `{ value: seed }` on the task, the first read throws `UnsetSignalValueError` and routes to `nil`, not `stale`. Omitting `stale` falls back to `ok`, leaving the retained value in place while the task re-fetches.
