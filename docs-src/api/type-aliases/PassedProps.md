[**le-truc**](../README.md)

***

[le-truc](../globals.md) / PassedProps

# Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = `{ [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>> }`

Defined in: [src/effects/pass.ts:22](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/effects/pass.ts#L22)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
