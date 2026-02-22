### Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = `{ [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>> }`

Defined in: [src/effects/pass.ts:22](https://github.com/zeixcom/le-truc/blob/29beeda732ab654fc5e6eab73c276e5a5367d43a/src/effects/pass.ts#L22)

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
