# Claude AI Context — Le Truc

> This file lists things an LLM should know about Le Truc that may be surprising, non-obvious, or easy to get wrong. It is not a general introduction — see `ARCHITECTURE.md` for structure and `package.json` for project metadata.

## Surprising Behaviors

- **Parser branding is required for reliable detection**: `isParser()` checks for `PARSER_BRAND` first. Unbranded functions fall back to `fn.length >= 2`, which is unreliable (default params, rest params, and destructuring all affect `.length`). Always use `asParser()` to create custom parsers; in DEV_MODE, using an unbranded function triggers a `console.warn`.

- **`pass()` is Le Truc–only and replaces signals, not values**: `pass(props)` calls `slot.replace(signal)` on the child's internal Slot map — it only works for Le Truc components whose properties are Slot-backed. For any other custom element or plain HTML element, use `setProperty()` instead. The original signal is captured and restored when the parent disconnects, so the child regains its own independent state after detachment.

- **`MethodProducer` is branded, not structurally distinguished**: `isMethodProducer()` checks for `METHOD_BRAND`. Always wrap method producer initializers with `asMethod()` — e.g. `clearMethod`, `add`, `delete` in `module-list`. Unbranded `(ui) => void` functions are treated as Readers, not method producers. `provideContexts()` is an `Effect`, not a method producer — use it in the setup function as `host: provideContexts([...])`.

- **`all()` MutationObserver is lazy**: The observer only activates when the `Memo` is read inside a reactive effect. The observer watches attribute changes implied by the CSS selector (classes, IDs, `[attr]` patterns) — not all mutations. Since `cause-effect` 0.18.4, the memo's `equals` check is fully respected: if an `innerHTML` mutation doesn't change which elements match the selector, downstream effects do not re-run.

- **`setAttribute` has security validation**: Blocks `on*` event handler attributes and validates URL attributes against a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`). Violations throw a descriptive error logged at `LOG_ERROR` level — they are never silent.

- **Dependency resolution times out at 200ms**: If a queried custom element isn't defined within 200ms, a `DependencyTimeoutError` is logged but effects proceed anyway.

- **`toggleAttribute` and `setAttribute` default their reactive to the effect name**: `toggleAttribute('loading')` reads `host.loading`. The second argument may be omitted when the property name matches the attribute name.

- **`on()` handler return value updates host**: If an event handler returns `{ prop: value }`, those updates are applied to the host in a `batch()`. Returning nothing (or `undefined`) is a no-op.

- **Context protocol is the Web Components Community Protocol**: `provideContexts` / `requestContext` implement the [webcomponents-cg context spec](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md), not a custom protocol.

- **`undefined` from a reader restores original DOM value**: When a reactive resolves to `undefined` (e.g. after an error in a reader, or a missing property), the effect restores the DOM value captured at setup time — not a blank/null state. The `RESET` symbol no longer exists.

- **Debug mode**: Set `host.debug = true` on a component instance for verbose per-instance logging. For project-wide enhanced errors and logging, build with `process.env.DEV_MODE=true`.
