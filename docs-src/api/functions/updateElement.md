### Function: updateElement()

> **updateElement**\<`T`, `P`, `E`\>(`reactive`, `updater`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects.ts:186](https://github.com/zeixcom/le-truc/blob/29beeda732ab654fc5e6eab73c276e5a5367d43a/src/effects.ts#L186)

Shared abstraction used by all built-in DOM effects.

Captures the current DOM value as a fallback, then creates a `createEffect` that
re-runs whenever the reactive value changes. On each run:
- `RESET` → restore the original DOM value
- `null` → call `updater.delete` if available, else restore fallback
- anything else → call `updater.update` if the value changed

#### Type Parameters

##### T

`T` *extends* `object`

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `Element`

#### Parameters

##### reactive

[`Reactive`](../type-aliases/Reactive.md)\<`T`, `P`, `E`\>

Reactive value driving the DOM update (property name, signal, or reader function)

##### updater

[`ElementUpdater`](../type-aliases/ElementUpdater.md)\<`E`, `T`\>

Describes how to read, update, and optionally delete the DOM property

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect that manages the reactive DOM update and returns a cleanup function

#### Since

0.9.0
