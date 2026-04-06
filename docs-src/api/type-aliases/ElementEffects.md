### Type Alias: ElementEffects\<P, E\>

> **ElementEffects**\<`P`, `E`\> = [`Effect`](Effect.md)\<`P`, `E`\> \| [`Effect`](Effect.md)\<`P`, `E`\>[]

Defined in: [src/effects.ts:56](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L56)

One or more effects for a single UI element.
The setup function may return a single `Effect` or an array of `Effect`s
for each key of the UI object.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### E

`E` *extends* `Element`
