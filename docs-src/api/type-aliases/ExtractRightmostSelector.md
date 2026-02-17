[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ExtractRightmostSelector

# Type Alias: ExtractRightmostSelector\<S\>

> **ExtractRightmostSelector**\<`S`\> = `S` *extends* `` `${string} ${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}>${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}+${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}~${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S`

Defined in: [src/ui.ts:20](https://github.com/zeixcom/le-truc/blob/d14510e550dfc154f9f0472e7b8adcdb3ab3002e/src/ui.ts#L20)

## Type Parameters

### S

`S` *extends* `string`
