### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = `{ [K in keyof Q & string]?: Reactive<Q[K], P> }`

Defined in: [src/effects.ts:77](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/effects.ts#L77)

A map of child component property names to the reactive values to inject into them.
Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
