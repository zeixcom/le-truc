### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = `{ [K in keyof Q & string]?: PassedProp<Q[K], P, HTMLElement & Q> }`

Defined in: [src/effects/pass.ts:34](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects/pass.ts#L34)

A map of child component property names to the reactive values to inject into them.
Passed as the argument to `pass()`. Keys must be property names of the target component `Q`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
