---
title: "UI API"
description: "Reference for selector-aware query helpers, element memos, and exported selector types."
---

Import path for everything on this page:

```ts
import {
  createElementsMemo,
  type AllElements,
  type ElementFromSelector,
  type ElementFromSingleSelector,
  type ElementQueries,
  type ElementsFromSelectorArray,
  type ExtractRightmostSelector,
  type ExtractTag,
  type ExtractTagFromSimpleSelector,
  type FirstElement,
  type KnownTag,
  type SplitByComma,
  type TrimWhitespace,
} from '@zeix/le-truc'
```

Source files: `src/ui.ts`, `types/src/ui.d.ts`.

## Query Helper Types

```ts
type FirstElement = {
  <S extends string>(selector: S, required: string): ElementFromSelector<S>
  <S extends string>(selector: S): ElementFromSelector<S> | undefined
  <E extends Element>(selector: string, required: string): E
  <E extends Element>(selector: string): E | undefined
}

type AllElements = {
  <S extends string>(selector: S, required?: string): Memo<ElementFromSelector<S>[]>
  <E extends Element>(selector: string, required?: string): Memo<E[]>
}

type ElementQueries = {
  first: FirstElement
  all: AllElements
}
```

These are surfaced through `FactoryContext`, not as standalone root functions.

## `createElementsMemo`

```ts
function createElementsMemo<S extends string>(
  parent: ParentNode,
  selector: S,
): Memo<ElementFromSelector<S>[]>
function createElementsMemo<E extends Element>(
  parent: ParentNode,
  selector: string,
): Memo<E[]>
```

This helper powers `all()`. It uses a lazily activated `MutationObserver` and only invalidates when added, removed, or changed nodes could affect the selector.

## Selector Type Utilities

```ts
type SplitByComma<S extends string> = ...
type TrimWhitespace<S extends string> = ...
type ExtractRightmostSelector<S extends string> = ...
type ExtractTagFromSimpleSelector<S extends string> = ...
type ExtractTag<S extends string> = ...
type KnownTag<S extends string> = ...
type ElementFromSingleSelector<S extends string> = ...
type ElementsFromSelectorArray<Selectors extends readonly string[]> = ...
type ElementFromSelector<S extends string> = ...
```

These types are why `first('button')` narrows to `HTMLButtonElement` and `all('circle')` narrows to `SVGCircleElement[]` when the selector is specific enough.

## Example

```ts
defineComponent('search-results', ({ first, all, watch }) => {
  const form = first('form', 'Needed to submit searches.')
  const items = all('li.result')

  return [
    watch(items, results => {
      console.log(results.length)
    }),
  ]
})
```

## Notes

- `first()` and `all()` throw `MissingElementError` when the optional `required` message is supplied and nothing matches.
- Queried custom elements that are not yet defined are collected as dependencies so activation can wait for them.
- Query roots use `host.shadowRoot ?? host`, so the same API works for light DOM and shadow DOM components.
