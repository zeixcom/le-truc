---
title: "Helpers API"
description: "Reference for the DOM binding helpers used with watch and match handlers."
---

Import path for everything on this page:

```ts
import {
  bindAttribute,
  bindClass,
  bindProperty,
  bindStyle,
  bindText,
  bindVisible,
  dangerouslyBindInnerHTML,
  type DangerouslyBindInnerHTMLOptions,
} from '@zeix/le-truc'
```

Source files: `index.ts`, `src/helpers.ts`, `types/src/helpers.d.ts`.

## `bindText`

```ts
const bindText: (
  element: Element,
  preserveComments?: boolean,
) => (value: string | number) => void
```

Updates `textContent`, optionally preserving HTML comments through `setTextPreservingComments()`.

## `bindProperty`

```ts
const bindProperty: <O extends object, K extends keyof O & string>(
  object: O,
  key: K,
) => (value: O[K]) => void
```

## `bindClass`

```ts
const bindClass: <T = boolean>(
  element: Element,
  token: string,
) => (value: T) => void
```

## `bindVisible`

```ts
const bindVisible: <T = boolean>(
  element: HTMLElement,
) => (value: T) => void
```

## `bindAttribute`

```ts
const bindAttribute: (
  element: Element,
  name: string,
  allowUnsafe?: boolean,
) => SingleMatchHandlers<string | boolean>
```

Boolean values toggle the attribute. String values route through `safeSetAttribute()` unless `allowUnsafe` is `true`.

## `bindStyle`

```ts
const bindStyle: (
  element: HTMLElement | SVGElement | MathMLElement,
  prop: string,
) => SingleMatchHandlers<string>
```

## `DangerouslyBindInnerHTMLOptions`

```ts
type DangerouslyBindInnerHTMLOptions = {
  shadowRootMode?: ShadowRootMode
  allowScripts?: boolean
}
```

## `dangerouslyBindInnerHTML`

```ts
const dangerouslyBindInnerHTML: (
  element: Element,
  options?: DangerouslyBindInnerHTMLOptions,
) => SingleMatchHandlers<string>
```

This helper schedules `innerHTML` writes, can attach a shadow root on demand, and can optionally re-execute injected scripts. Its name is intentionally explicit because the library treats this as a sharp tool.

## Example

```ts
return [
  watch('label', bindText(output)),
  watch(() => host.isActive, bindClass(panel, 'is-active')),
  watch(() => host.hidden, bindVisible(message)),
  watch(() => host.href, bindAttribute(link, 'href')),
]
```

Use binders whenever a watcher’s side effect is a straightforward DOM mutation. It keeps component factories short and makes the reactive intent obvious at a glance.

## Choosing the Right Binder

- Use `bindText()` when the target is text-only and you do not need branching behavior.
- Use `bindAttribute()` or `bindStyle()` when `nil` should remove the value rather than stringify it.
- Use `bindProperty()` for imperative DOM APIs such as `input.value`, `dialog.open`, or `video.currentTime`.
- Reserve `dangerouslyBindInnerHTML()` for trusted HTML fragments and prefer `bindText()` plus `escapeHTML()` when the source can contain user input.

The shipped examples mostly favor `bindText()`, especially in `examples/basic/hello/basic-hello.ts` and `examples/basic/number/basic-number.ts`, because text replacement is the most common “pinpoint update” that Le Truc optimizes for.
