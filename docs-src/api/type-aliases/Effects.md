### Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:30](https://github.com/zeixcom/le-truc/blob/bd432f985e61e9e2dae7b18991cbac4902b95d05/src/effects.ts#L30)

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md) & `object`
