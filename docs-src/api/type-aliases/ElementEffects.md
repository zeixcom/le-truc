### Type Alias: ElementEffects\<P, E\>

> **ElementEffects**\<`P`, `E`\> = [`Effect`](Effect.md)\<`P`, `E`\> \| [`Effect`](Effect.md)\<`P`, `E`\>[]

Defined in: [src/effects.ts:37](https://github.com/zeixcom/le-truc/blob/ecfd71ac3d27d86bcfc647fabb6e10e7d9f11413/src/effects.ts#L37)

One or more effects for a single UI element.
The setup function may return a single `Effect` or an array of `Effect`s
for each key of the UI object.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### E

`E` *extends* `Element`
