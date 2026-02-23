# Claude AI Context — Le Truc

> This file lists things an LLM should know about Le Truc that may be surprising, non-obvious, or easy to get wrong. It is not a general introduction — see `ARCHITECTURE.md` for structure and `package.json` for project metadata.

## Surprising Behaviors

- **Parser vs Reader detection is fragile**: `isParser()` checks `fn.length >= 2`. Functions with default parameters, rest params, or destructuring will have unexpected `.length` values and may be misclassified. A parser `(ui, value = '') => ...` has `length === 1` and will be treated as a Reader.

- **`pass()` replaces signals, not values**: `pass(props)` calls `slot.replace(signal)` on the child's internal signal map. This creates a live parent→child binding; the child loses its own signal entirely until disconnected.

- **`MethodProducer` is invisible to the type system**: `provideContexts()` returns a function `(ui) => void`. There's no runtime distinction between a Reader and a MethodProducer — it works because `#setAccessor` silently skips `undefined` return values.

- **`all()` MutationObserver is lazy**: The observer only activates when the `Memo` is read inside a reactive effect. The observer watches attribute changes implied by the CSS selector (classes, IDs, `[attr]` patterns) — not all mutations. Since `cause-effect` 0.18.4, the memo's `equals` check is fully respected: if an `innerHTML` mutation doesn't change which elements match the selector, downstream effects do not re-run.

- **`setAttribute` has security validation**: Blocks `on*` event handler attributes and validates URL attributes against a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`). This means `setAttribute('href', 'javascript:...')` will silently fail.

- **Dependency resolution times out at 200ms**: If a queried custom element isn't defined within 200ms, a `DependencyTimeoutError` is logged but effects proceed anyway.

- **`toggleAttribute` and `setAttribute` default their reactive to the effect name**: `toggleAttribute('loading')` reads `host.loading`. The second argument may be omitted when the property name matches the attribute name.

- **`on()` handler return value updates host**: If an event handler returns `{ prop: value }`, those updates are applied to the host in a `batch()`. Returning nothing (or `undefined`) is a no-op.

- **Context protocol is the Web Components Community Protocol**: `provideContexts` / `requestContext` implement the [webcomponents-cg context spec](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md), not a custom protocol.

- **`RESET` sentinel restores original DOM value**: When a reactive resolves to the `RESET` symbol (e.g. after an error in a reader), the effect restores the DOM value captured at setup time — not a blank/null state.

- **Debug mode**: Set `host.debug = true` on a component instance for verbose per-instance logging. For project-wide enhanced errors and logging, build with `process.env.DEV_MODE=true`.
