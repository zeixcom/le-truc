### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = \{ \[K in keyof Q & string\]?: Reactive\<Q\[K\], P\> \| SlotDescriptor\<Q\[K\] & \{\}\> \}

Defined in: [src/helpers/reactive.ts:56](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/helpers/reactive.ts#L56)

A map of child component property names to the reactive values to inject into them.
Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
