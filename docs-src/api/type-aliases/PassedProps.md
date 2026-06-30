### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = \{ \[K in keyof Q & string\]?: Reactive\<Q\[K\], P\> \| SlotDescriptor\<Q\[K\] & \{\}\> \}

Defined in: [src/helpers/reactive.ts:61](https://github.com/zeixcom/le-truc/blob/2877d2afe24fa5dcc6cc8851f03777f67a181664/src/helpers/reactive.ts#L61)

A map of child component property names to the reactive values to inject into them.
Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.

Prefer the read-only thunk (`() => host.prop`) and the mediated
`{ get, set }` descriptor forms. The property-key and bare-writable-signal
forms are deprecated; they warn in DEV_MODE and will be removed in the next major.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
