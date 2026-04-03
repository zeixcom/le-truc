### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = `{ [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>> }`

Defined in: [src/effects/pass.ts:34](https://github.com/zeixcom/le-truc/blob/be10586073df9ae2ebe5b85bd4fcca8a69e532d4/src/effects/pass.ts#L34)

A map of child component property names to the reactive values to inject into them.
Passed as the argument to `pass()`. Keys must be property names of the target component `Q`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
