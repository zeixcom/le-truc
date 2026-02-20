### Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:30](https://github.com/zeixcom/le-truc/blob/569c3554a3bd73c7996dc67fec548045ec940d32/src/effects.ts#L30)

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md) & `object`
