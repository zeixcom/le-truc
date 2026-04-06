# Claude AI Context — Le Truc

> This file lists things an LLM should know about Le Truc that may be surprising, non-obvious, or easy to get wrong. It is not a general introduction — see `ARCHITECTURE.md` for structure and `package.json` for project metadata.

## v1.1 Factory Form (current)

The v1.1 factory form is the primary way to define components. The factory receives a `FactoryContext` with helpers `{ all, each, expose, first, host, on, pass, provideContexts, requestContext, watch }`, calls `expose({ ... })` for reactive props, and returns a flat `FactoryResult` array of effect descriptors:

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

The v1.0 4-param form (`defineComponent(name, props, select, setup)`) is **deprecated** but remain fully supported.

## Surprising Behaviors

- **The factory form has `observedAttributes = []` — parsers are called once, not reactively**: Both the v1.1 factory form and the v1.0 factory form set `static observedAttributes = []` unconditionally. Parsers passed to `expose()` are called once at connect time with the current attribute value (for server-side HTML author configuration), but `attributeChangedCallback` never fires. Use the 4-param form when attribute changes on a live document must drive reactive updates.

- **Parser branding is required for reliable detection**: `isParser()` checks for `PARSER_BRAND` first. Unbranded functions fall back to `fn.length >= 2`, which is unreliable (default params, rest params, and destructuring all affect `.length`). Always use `asParser()` to create custom parsers; in DEV_MODE, using an unbranded function triggers a `console.warn`.

- **`pass()` is Le Truc–only and replaces signals, not values**: The factory `pass(target, props)` calls `slot.replace(signal)` on the child's internal Slot map — it only works for Le Truc components whose properties are Slot-backed. For any other custom element or plain HTML element, use `setProperty()` instead. The original signal is captured and restored when the parent disconnects, so the child regains its own independent state after detachment.

- **`MethodProducer` is branded, not structurally distinguished**: `isMethodProducer()` checks for `METHOD_BRAND`. Always wrap method producer initializers with `asMethod()` — e.g. `clear`, `add`, `delete` in v1.1 components. Unbranded `() => void` functions are treated as Readers, not method producers. `provideContexts([...])` in the factory context returns an `EffectDescriptor` — include it in the return array as `return [provideContexts([MEDIA_MOTION, ...])]`.

- **`all()` MutationObserver is lazy**: The observer only activates when the `Memo` is read inside a reactive effect. The observer watches attribute changes implied by the CSS selector (classes, IDs, `[attr]` patterns) — not all mutations. Since `cause-effect` 0.18.4, the memo's `equals` check is fully respected: if an `innerHTML` mutation doesn't change which elements match the selector, downstream effects do not re-run.

- **`setAttribute` has security validation**: Blocks `on*` event handler attributes and validates URL attributes against a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`). Violations throw a descriptive error logged at `LOG_ERROR` level — they are never silent.

- **Dependency resolution times out at 200ms**: If a queried custom element isn't defined within 200ms, a `DependencyTimeoutError` is logged but effects proceed anyway.

- **`on()` factory handler return value updates host**: If the factory `on(target, type, handler)` handler returns `{ prop: value }`, those updates are applied to the host in a `batch()`. Returning nothing (or `undefined`) is a no-op.

- **Context protocol is the Web Components Community Protocol**: `provideContexts` / `requestContext` implement the [webcomponents-cg context spec](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md), not a custom protocol. In v1.1: `provideContexts([...])` returns an `EffectDescriptor` used in the return array; `requestContext(context, fallback)` returns a `Memo<T>` used directly in `expose()`.

- **`undefined` from a reader restores original DOM value**: When a reactive resolves to `undefined` (e.g. after an error in a reader, or a missing property), the effect restores the DOM value captured at setup time — not a blank/null state. The `RESET` symbol no longer exists.

- **`createEventsSensor` v1.1 signature**: The v1.1 form is `createEventsSensor(element, init, events)` — the element is the first argument. Used inside `expose()`: `length: createEventsSensor(textbox, textbox.value.length, { input: ({ target }) => target.value.length })`.

- **Debug mode**: Set `host.debug = true` on a component instance for verbose per-instance logging. For project-wide enhanced errors and logging, build with `process.env.DEV_MODE=true`.

- **`bindVisible` is the inverse of `el.hidden`**: `bindVisible(el)` sets `el.hidden = !value`, matching v1.0 `show()`. A value of `true` makes the element visible.

- **`bindAttribute` returns `WatchHandlers`, not a function**: Use as `watch('prop', bindAttribute(el, 'name'))` — `watch` accepts both forms.

- **`bindAttribute` boolean dispatch**: When the reactive value is boolean, `toggleAttribute` is called — the attribute is added (without value) when `true` and removed when `false`. Do not pass boolean for attributes that require a string value.

- **`bindStyle` nil path removes the inline style**: When the reactive is nil, `el.style.removeProperty(prop)` is called, restoring whatever value the CSS cascade provides. Setting the reactive back to a string re-applies the inline style.
