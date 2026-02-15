[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / PassedProps

# Type Alias: PassedProps\<P, Q\>

> **PassedProps**\<`P`, `Q`\> = `{ [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>> }`

Defined in: [src/effects/pass.ts:18](https://github.com/zeixcom/le-truc/blob/f24c1c5bc3c2b0911801769c1a46c70e066ccb8e/src/effects/pass.ts#L18)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)
