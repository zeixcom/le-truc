[**le-truc**](../README.md)

***

[le-truc](../globals.md) / Effects

# Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:30](https://github.com/zeixcom/le-truc/blob/adc7f347d870e640578165aa28996ebdcb7a5c42/src/effects.ts#L30)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### U

`U` *extends* [`UI`](UI.md) & `object`
