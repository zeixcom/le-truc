[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Effects

# Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:29](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/effects.ts#L29)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### U

`U` *extends* [`UI`](UI.md) & `object`
