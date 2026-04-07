### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = `{ [K in keyof Q & string]?: Reactive<Q[K], P> }`

Defined in: [src/effects.ts:73](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/effects.ts#L73)

A map of child component property names to the reactive values to inject into them.
Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
