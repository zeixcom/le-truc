### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = \{ \[K in keyof Q & string\]?: Reactive\<Q\[K\], P\> \| SlotDescriptor\<Q\[K\] & \{\}\> \}

Defined in: [src/effects.ts:68](https://github.com/zeixcom/le-truc/blob/a6ba00692d657f602c75b7a74d7e0a0da4505ef9/src/effects.ts#L68)

A map of child component property names to the reactive values to inject into them.
Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
