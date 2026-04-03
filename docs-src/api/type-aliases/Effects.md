### Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:46](https://github.com/zeixcom/le-truc/blob/be10586073df9ae2ebe5b85bd4fcca8a69e532d4/src/effects.ts#L46)

The return type of the `setup` function passed to `defineComponent`.
Keys correspond to keys of the UI object (queried elements and `host`);
values are one or more effects to run for that element.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md) & `object`
