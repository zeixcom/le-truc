[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Effects

# Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:31](https://github.com/zeixcom/le-truc/blob/278ab0df3fbdca5f6b0f0436bf1688626c821080/src/effects.ts#L31)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### U

`U` *extends* [`UI`](UI.md) & `object`
