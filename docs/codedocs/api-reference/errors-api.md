---
title: "Errors API"
description: "Reference for Le Truc-specific error classes and the runtime conditions that trigger them."
---

Import path for everything on this page:

```ts
import {
  DependencyTimeoutError,
  InvalidComponentNameError,
  InvalidCustomElementError,
  InvalidPropertyNameError,
  InvalidReactivesError,
  MissingElementError,
} from '@zeix/le-truc'
```

Source file: `src/errors.ts`.

## Error Classes

### `InvalidComponentNameError`

```ts
class InvalidComponentNameError extends TypeError {
  constructor(component: string)
}
```

Thrown by `defineComponent()` when the tag name is not a valid lowercase custom element name.

### `InvalidPropertyNameError`

```ts
class InvalidPropertyNameError extends TypeError {
  constructor(component: string, prop: string, reason: string)
}
```

Represents property name conflicts with `HTMLElement` members or reserved words.

### `MissingElementError`

```ts
class MissingElementError extends Error {
  constructor(host: HTMLElement, selector: string, required: string)
}
```

Thrown by `first()` or `all()` when a required selector does not match.

### `DependencyTimeoutError`

```ts
class DependencyTimeoutError extends Error {
  constructor(host: HTMLElement, missing: string[])
}
```

Logged in development if descendant custom elements do not become defined within the timeout window in `src/ui.ts`.

### `InvalidReactivesError`

```ts
class InvalidReactivesError extends TypeError {
  constructor(host: HTMLElement, target: HTMLElement, reactives: unknown)
}
```

Thrown by `pass()` when the props map is not a record of reactive sources.

### `InvalidCustomElementError`

```ts
class InvalidCustomElementError extends TypeError {
  constructor(target: HTMLElement, where: string)
}
```

Thrown by `pass()` when the target is not a custom element.

## Practical Guidance

- Prefer `first(selector, reason)` over unchecked `first(selector)` during development so missing structure fails loudly.
- If `DependencyTimeoutError` appears, ensure child custom elements are defined before parent activation or split bundles more carefully.
- If `pass()` warns that a property is not Slot-backed, check whether the child actually exposed that property as mutable reactive state.

One subtle detail from `src/ui.ts` is that `DependencyTimeoutError` is logged in development but does not block activation forever. Le Truc deliberately continues in a degraded mode after the timeout because progressive enhancement is more useful than a hard failure on pages where one late child component should not disable the entire parent.

Likewise, the error classes are intentionally precise rather than generic. When documentation and code both reference these names, teams can search for the exact thrown condition instead of guessing whether a failure came from selectors, property shape, or composition.
