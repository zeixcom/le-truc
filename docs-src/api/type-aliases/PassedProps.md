### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = \{ \[K in keyof Q & string\]?: Reactive\<Q\[K\], P\> \| SlotDescriptor\<Q\[K\] & \{\}\> \}

Defined in: [src/helpers/reactive.ts:56](https://github.com/zeixcom/le-truc/blob/d9cecae8c3e9e30027448b835ac249fc4170548e/src/helpers/reactive.ts#L56)

A map of child component property names to the reactive values to inject into them.
Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
