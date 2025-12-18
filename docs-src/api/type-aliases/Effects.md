[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Effects

# Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:31](https://github.com/zeixcom/le-truc/blob/18042e4c4fbfc3b2f2479cf6ec1867dbaa7b7796/src/effects.ts#L31)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### U

`U` *extends* [`UI`](UI.md) & `object`
