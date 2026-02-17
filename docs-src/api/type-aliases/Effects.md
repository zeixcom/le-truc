[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Effects

# Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U & string]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:29](https://github.com/zeixcom/le-truc/blob/755557440db1d4332483c0516277bf183e3ff944/src/effects.ts#L29)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### U

`U` *extends* [`UI`](UI.md) & `object`
