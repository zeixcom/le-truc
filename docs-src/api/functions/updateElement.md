### Function: updateElement()

> **updateElement**\<`T`, `P`, `E`\>(`reactive`, `updater`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects.ts:189](https://github.com/zeixcom/le-truc/blob/86fb9468cbc91aefb5ba2e30aa8cbb9b82db97bb/src/effects.ts#L189)

Shared abstraction used by all built-in DOM effects.

Captures the current DOM value as a fallback, then creates a `createEffect` that
re-runs whenever the reactive value changes. On each run:
- `undefined` → restore the original DOM value
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
