[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / PassedProps

# Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = `{ [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>> }`

Defined in: [src/effects/pass.ts:22](https://github.com/zeixcom/le-truc/blob/18042e4c4fbfc3b2f2479cf6ec1867dbaa7b7796/src/effects/pass.ts#L22)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
