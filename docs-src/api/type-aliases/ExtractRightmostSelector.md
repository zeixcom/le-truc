[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ExtractRightmostSelector

# Type Alias: ExtractRightmostSelector\<S\>

> **ExtractRightmostSelector**\<`S`\> = `S` *extends* `` `${string} ${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}>${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}+${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}~${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S`

Defined in: [src/ui.ts:20](https://github.com/zeixcom/le-truc/blob/c62468fd9c5d5c7240f34b9daac5034cede67a90/src/ui.ts#L20)

## Type Parameters

### S

`S` *extends* `string`
