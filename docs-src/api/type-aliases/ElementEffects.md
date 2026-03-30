### Type Alias: ElementEffects\<P, E\>

> **ElementEffects**\<`P`, `E`\> = [`Effect`](Effect.md)\<`P`, `E`\> \| [`Effect`](Effect.md)\<`P`, `E`\>[]

Defined in: [src/effects.ts:37](https://github.com/zeixcom/le-truc/blob/8e260db69c2a07fca5b7a6e4feb1c02c605094f0/src/effects.ts#L37)

One or more effects for a single UI element.
The setup function may return a single `Effect` or an array of `Effect`s
for each key of the UI object.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### E

`E` *extends* `Element`
