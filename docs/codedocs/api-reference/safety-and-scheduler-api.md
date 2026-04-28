---
title: "Safety and Scheduler API"
description: "Reference for safe DOM mutation helpers and the requestAnimationFrame scheduler utilities."
---

Import path for everything on this page:

```ts
import {
  escapeHTML,
  safeSetAttribute,
  schedule,
  setTextPreservingComments,
  throttle,
} from '@zeix/le-truc'
```

Source files: `src/safety.ts`, `src/scheduler.ts`.

## `safeSetAttribute`

```ts
const safeSetAttribute: (
  element: Element,
  attr: string,
  value: string,
) => void
```

Rejects `on*` handler attributes and blocks unsafe URL schemes such as `javascript:`, `data:`, and `vbscript:`.

## `escapeHTML`

```ts
const escapeHTML: (text: string) => string
```

Escapes `&`, `<`, `>`, `"`, and `'`.

## `setTextPreservingComments`

```ts
const setTextPreservingComments: (
  element: Element,
  text: string,
) => void
```

Removes non-comment children and appends one text node.

## `schedule`

```ts
const schedule: (key: object, task: () => void) => void
```

Queues a task for the next animation frame and deduplicates by object key. `dangerouslyBindInnerHTML()` uses this to coalesce repeated writes.

## `throttle`

```ts
const throttle: <T extends (...args: any[]) => void>(
  fn: T,
  signal?: AbortSignal,
) => T & { cancel: () => void }
```

Runs a callback at most once per animation frame, always with the latest arguments.

## Example

```ts
const updateScroll = throttle((event: Event) => {
  console.log(event.type)
})

window.addEventListener('scroll', updateScroll, { passive: true })
```

These APIs are small but important because they enforce the library’s stance on DOM writes: security-sensitive mutations should be centralized, and noisy updates should share the same RAF-based scheduler rather than each component inventing its own timing logic.

## Practical Guidance

- Prefer `bindAttribute()` over direct `setAttribute()` calls when a watched value may be a URL or when the attribute might accidentally become an event handler name.
- Use `schedule()` when many updates can collapse into a single final write per frame. `dangerouslyBindInnerHTML()` does exactly that so repeated source changes do not churn the DOM.
- Use `throttle()` at the event boundary for scroll, resize, and pointer-heavy handlers. The event helper in `src/events.ts` already applies this automatically for the library’s passive event set.

These utilities are intentionally low-level. Most component code will touch them indirectly through the higher-level binders on the [Helpers API](/docs/api-reference/helpers-api) page.
