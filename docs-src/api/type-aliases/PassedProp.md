### Type Alias: PassedProp\<T, P\>

> **PassedProp**\<`T`, `P`\> = keyof `P` \| [`Signal`](Signal.md)\<`T` & `object`\> \| ((`host`) => `T`)

Defined in: [src/effects.ts:61](https://github.com/zeixcom/le-truc/blob/6e56893b2946c17dd4fe36c76f1a09d8d1d02488/src/effects.ts#L61)

A single reactive value to pass to a descendant Le Truc component property.

Three forms are accepted:
- `keyof P` — a string property name on the host
- `Signal<T>` — any signal
- `(host: HTMLElement & P) => T` — a reader function receiving the host

#### Type Parameters

##### T

`T`

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)
