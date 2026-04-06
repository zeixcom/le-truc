### Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:65](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L65)

The return type of the `setup` function passed to `defineComponent`.
Keys correspond to keys of the UI object (queried elements and `host`);
values are one or more effects to run for that element.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md) & `object`
