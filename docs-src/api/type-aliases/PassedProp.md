### Type Alias: PassedProp\<T, P, E\>

> **PassedProp**\<`T`, `P`, `E`\> = [`Reactive`](Reactive.md)\<`T`, `P`, `E`\>

Defined in: [src/effects/pass.ts:24](https://github.com/zeixcom/le-truc/blob/8116637b61338698dc385b85f1753152b3bdc512/src/effects/pass.ts#L24)

A single reactive value to pass to a descendant Le Truc component property.
Accepts the same forms as `Reactive<T, P, E>`: a host property name,
a `Signal`, or a reader function.

#### Type Parameters

##### T

`T`

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### E

`E` *extends* `HTMLElement`
