# Agent Context — Le Truc

> This file lists things an agent should know about Le Truc that may be surprising, non-obvious, or easy to get wrong. It is not a general introduction — see `ARCHITECTURE.md` for structure and `package.json` for project metadata.

## Factory Form

The factory form is the only way to define components. The factory receives a `FactoryContext` with helpers `{ all, expose, first, host, on, pass, provideContexts, requestContext, watch }`, calls `expose({ ... })` for reactive props, and returns a `FactoryResult` — an array of effect descriptors (nested arrays are flattened; falsy values are filtered):

```ts
defineComponent<MyProps>('my-element', ({ expose, first, host, on, watch }) => {
  const input = first('input') as HTMLInputElement
  expose({ value: input.value })
  return [
    on(input, 'input', () => ({ value: input.value })),
    watch('value', v => { input.value = v }),
  ]
})
```

## Surprising Behaviors

- **No `observedAttributes` support — parsers are called once, not reactively**: `defineComponent` never registers `observedAttributes`; `attributeChangedCallback` support was dropped entirely in v2.0. Parsers passed to `expose()` read the attribute value once at connect time (for server-side HTML author configuration). Attribute values drive state only at connect time. To react to attribute changes after connection, use event handlers or `watch()`.

- **Parser branding is required for reliable detection**: `isParser()` checks only for `PARSER_BRAND`. Always use `asParser()` to create custom parsers — unbranded functions are NOT treated as parsers regardless of their argument count.

- **`Parser<T>` takes the attribute value only**: Signature is `(value: string | null | undefined) => T`. Fallbacks are static values captured in the factory closure.

- **`pass()` is Le Truc–only and replaces signals, not values**: The factory `pass(target, props)` calls `slot.replace(signal)` on the child's internal Slot map — it only works for Le Truc components whose properties are Slot-backed. For any other custom element or plain HTML element, use `watch(source, bindProperty(el, key))` instead. `bindProperty` assigns to the element's public JS setter and works correctly regardless of the child's internal framework. When `pass()` is used the original signal is captured and restored when the parent disconnects, so the child regains its own independent state after detachment.

- **`MethodProducer` is branded, not structurally distinguished**: `isMethodProducer()` checks for `METHOD_BRAND`. Always wrap method producer initializers with `defineMethod()` — e.g. `clear`, `add`, `delete`. Unbranded `() => void` functions are wrapped in `createComputed()` (treated as a `MemoCallback`), not installed as method producers. `provideContexts([...])` in the factory context returns an `EffectDescriptor` — include it in the return array as `return [provideContexts([MEDIA_MOTION, ...])]`.

- **`all()` MutationObserver is lazy**: The observer only activates when the `Memo` is read inside a reactive effect. The observer watches attribute changes implied by the CSS selector (classes, IDs, `[attr]` patterns) — not all mutations. Since `cause-effect` 0.18.4, the memo's `equals` check is fully respected: if an `innerHTML` mutation doesn't change which elements match the selector, downstream effects do not re-run.

- **`setAttribute` has security validation**: Blocks `on*` event handler attributes and validates URL attributes against a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`). Violations throw a descriptive error — they are never silent.

- **Dependency resolution timeout races with the child's own upgrade**: If a queried custom element isn't defined within 200ms (`DEPENDENCY_TIMEOUT`), a `DependencyTimeoutError` is logged and the parent's effects activate anyway against a child that may still be `:not(:defined)` — intentional progressive enhancement, not a bug. If a parent effect writes directly to that child's property (e.g. `watch('prop', bindProperty(child, 'prop'))`), the write lands as a plain instance property before upgrade. When the child later upgrades, `#initSignals` skips wrapping any prop already present on the instance in a reactive `Slot` ("explicit DOM value wins"), so the property never becomes reactive on the child — its own initializer is silently discarded. Don't write to a timed-out child's properties from a parent effect.

- **`on()` factory handler return value updates host**: If the factory `on(target, type, handler)` handler returns `{ prop: value }`, those updates are applied to the host in a `batch()`. Returning nothing (or `undefined`) is a no-op.

- **Context protocol is the Web Components Community Protocol**: `provideContexts` / `requestContext` implement the [webcomponents-cg context spec](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md), not a custom protocol. `provideContexts([...])` returns an `EffectDescriptor` used in the return array; `requestContext(context, fallback)` returns a `Memo<T>` used directly in `expose()`.

- **`undefined` from a reactive source restores original DOM value**: When a reactive resolves to `undefined` (e.g. after an error in a computed thunk, or a missing property), the effect restores the DOM value captured at setup time — not a blank/null state. The `RESET` symbol no longer exists.

- **Event-driven read-only props use `createState` + `on`**: Expose `state.get` (not the full `State`) to make a prop readable but not settable by consumers. Update the value in an `on()` handler. To watch the prop inside the factory, pass the signal directly: `watch(length, bindVisible(clearBtn))`.

- **`DEV_MODE` enables enhanced diagnostics**: Build with `process.env.DEV_MODE=true` for detailed error messages, dependency-timeout warnings, and effect-execution logging. No per-instance debug flag exists.

- **`bindVisible` is the inverse of `el.hidden`**: `bindVisible(el)` sets `el.hidden = !value`. A value of `true` makes the element visible.

- **`bindAttribute` returns `SingleMatchHandlers`, not a function**: Use as `watch('prop', bindAttribute(el, 'name'))` — `watch` accepts both a plain function and a `SingleMatchHandlers` object.

- **`bindAttribute` boolean dispatch**: When the reactive value is boolean, `toggleAttribute` is called — the attribute is added (without value) when `true` and removed when `false`. Do not pass boolean for attributes that require a string value.

- **`bindStyle` nil path removes the inline style**: When the reactive is nil, `el.style.removeProperty(prop)` is called, restoring whatever value the CSS cascade provides. Setting the reactive back to a string re-applies the inline style.

- **`stale` in `watch` only fires for `Task` signals with a seeded value**: Routing precedence is `nil` > `err` > `stale` > `ok`. `stale` fires when the signal has a retained value AND `isTask(signal) && signal.isPending()` — never for `State` or `Memo`. Without `{ value: seed }` on the task, the first read throws `UnsetSignalValueError` and routes to `nil`, not `stale`. Omitting `stale` falls back to `ok`, leaving the retained value in place while the task re-fetches.
