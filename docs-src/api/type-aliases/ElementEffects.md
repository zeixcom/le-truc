### Type Alias: ElementEffects\<P, E\>

> **ElementEffects**\<`P`, `E`\> = [`Effect`](Effect.md)\<`P`, `E`\> \| [`Effect`](Effect.md)\<`P`, `E`\>[]

Defined in: [src/effects.ts:37](https://github.com/zeixcom/le-truc/blob/4623838db83f9ada1ce0c2179fd724f26d6376e6/src/effects.ts#L37)

One or more effects for a single UI element.
The setup function may return a single `Effect` or an array of `Effect`s
for each key of the UI object.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### E

`E` *extends* `Element`
