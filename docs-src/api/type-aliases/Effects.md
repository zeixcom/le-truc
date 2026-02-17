[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Effects

# Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:29](https://github.com/zeixcom/le-truc/blob/d14510e550dfc154f9f0472e7b8adcdb3ab3002e/src/effects.ts#L29)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### U

`U` *extends* [`UI`](UI.md) & `object`
