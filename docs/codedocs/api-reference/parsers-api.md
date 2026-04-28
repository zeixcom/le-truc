---
title: "Parsers API"
description: "Reference for branded parsers, method producers, and the built-in attribute parsing helpers."
---

Import path for everything on this page:

```ts
import {
  asBoolean,
  asClampedInteger,
  asEnum,
  asInteger,
  asJSON,
  asNumber,
  asParser,
  asString,
  defineMethod,
  isMethodProducer,
  isParser,
  type MethodProducer,
  type Parser,
} from '@zeix/le-truc'
```

Source files: `src/parsers.ts`, `src/parsers/boolean.ts`, `src/parsers/number.ts`, `src/parsers/string.ts`, `src/parsers/json.ts`.

## Core Types

```ts
type Parser<T extends {}> = (value: string | null | undefined) => T

type MethodProducer = ((...args: any[]) => void) & {
  readonly [METHOD_BRAND]: true
}
```

## Branding Utilities

```ts
const asParser: <T extends {}>(fn: Parser<T>) => Parser<T>
const defineMethod: <T extends (...args: any[]) => void>(
  fn: T,
) => T & { readonly [METHOD_BRAND]: true }
const isParser: <T extends {}>(value: unknown) => value is Parser<T>
const isMethodProducer: (value: unknown) => value is MethodProducer
```

These functions are how `expose()` distinguishes between parse-at-connect initializers, direct methods, and ordinary values.

## Built-in Parsers

```ts
const asBoolean: () => Parser<boolean>
const asInteger: (fallback?: number) => Parser<number>
const asNumber: (fallback?: number) => Parser<number>
const asClampedInteger: (min?: number, max?: number) => Parser<number>
const asString: (fallback?: string) => Parser<string>
const asEnum: (valid: [string, ...string[]]) => Parser<string>
const asJSON: <T extends {}>(fallback: T) => Parser<T>
```

## Example

```ts
expose({
  count: asClampedInteger(0, 10),
  mode: asEnum(['summary', 'detail']),
  config: asJSON({ locale: 'en-US' }),
  reset: defineMethod(() => {
    host.count = 0
  }),
})
```

Behavior notes from the source:

- `asBoolean()` treats presence as `true` unless the value is the literal string `'false'`.
- `asInteger()` and `asClampedInteger()` handle hexadecimal values like `0x10`.
- `asEnum()` compares case-insensitively and falls back to the first allowed entry.
- `asJSON()` throws for invalid JSON and for the degenerate case where both the input and fallback are nullish.

## When Parsers Run

Parsers are evaluated by `#initSignals()` in `src/component.ts` when the component instance initializes its exposed properties. That means they are ideal for bootstrapping host state from attributes or server-rendered values, not for arbitrary runtime transforms inside `watch()`. If you need a reactive transformation after initialization, prefer a function source such as `watch(() => format(host.value), ...)` or a re-exported `createComputed()` signal.

The branding step matters because plain functions are ambiguous. `isParser()` only returns `true` for functions branded by `asParser()`, and `isMethodProducer()` only returns `true` for functions branded by `defineMethod()`. That explicitness keeps `expose()` deterministic.
