### Type Alias: PassedProp\<T, P\>

> **PassedProp**\<`T`, `P`\> = keyof `P` \| [`Signal`](Signal.md)\<`T` & `object`\> \| ((`host`) => `T`)

Defined in: [src/factory.ts:52](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/factory.ts#L52)

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
