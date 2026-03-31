### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = `{ [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>> }`

Defined in: [src/effects/pass.ts:34](https://github.com/zeixcom/le-truc/blob/f4d929d4f01267c5770e41b28447be2bc5184518/src/effects/pass.ts#L34)

A map of child component property names to the reactive values to inject into them.
Passed as the argument to `pass()`. Keys must be property names of the target component `Q`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
