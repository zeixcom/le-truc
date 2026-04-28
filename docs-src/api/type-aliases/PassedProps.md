### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = \{ \[K in keyof Q & string\]?: Reactive\<Q\[K\], P\> \| SlotDescriptor\<Q\[K\] & \{\}\> \}

Defined in: [src/effects.ts:68](https://github.com/zeixcom/le-truc/blob/95e5c3ab97d0cd1430adbe5ee92d9bdf2b5d274c/src/effects.ts#L68)

A map of child component property names to the reactive values to inject into them.
Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
