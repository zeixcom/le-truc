### Type Alias: Reactive\<T, P, E\>

> **Reactive**\<`T`, `P`, `E`\> = keyof `P` \| [`Signal`](Signal.md)\<`T` & `object`\> \| ((`target`) => `T` \| `null` \| `undefined`)

Defined in: [src/effects.ts:64](https://github.com/zeixcom/le-truc/blob/8e260db69c2a07fca5b7a6e4feb1c02c605094f0/src/effects.ts#L64)

A reactive value driving a DOM update inside an `updateElement` effect.

Three forms are accepted:
- `keyof P` — a string property name on the host; reads `host[name]` and
  registers it as a signal dependency automatically.
- `Signal<T>` — any signal; `.get()` is called inside the effect.
- `(target: E) => T | null | undefined` — a reader function receiving the
  target element; return `null` to delete the DOM value, `undefined` to
  restore the original fallback captured at setup time.

#### Type Parameters

##### T

`T`

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### E

`E` *extends* `Element`
