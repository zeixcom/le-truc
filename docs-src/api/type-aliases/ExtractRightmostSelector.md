[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ExtractRightmostSelector

# Type Alias: ExtractRightmostSelector\<S\>

> **ExtractRightmostSelector**\<`S`\> = `S` *extends* `` `${string} ${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}>${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}+${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}~${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S`

Defined in: [src/ui.ts:20](https://github.com/zeixcom/le-truc/blob/9067b0df4b01434796accabfb262c9896f05f14f/src/ui.ts#L20)

## Type Parameters

### S

`S` *extends* `string`
