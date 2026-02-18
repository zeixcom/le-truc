### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = `{ [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>> }`

Defined in: [src/effects/pass.ts:22](https://github.com/zeixcom/le-truc/blob/e24d2793804f24d536ad713492cc94d3689bbbde/src/effects/pass.ts#L22)

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
