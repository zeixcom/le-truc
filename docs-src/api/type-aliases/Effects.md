[**le-truc**](../README.md)

***

[le-truc](../globals.md) / Effects

# Type Alias: Effects\<P, U\>

> **Effects**\<`P`, `U`\> = `{ [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>> }`

Defined in: [src/effects.ts:31](https://github.com/zeixcom/le-truc/blob/e43af8d7276b550a9ea298d116a409ca894b7fd9/src/effects.ts#L31)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### U

`U` *extends* [`UI`](UI.md) & `object`
