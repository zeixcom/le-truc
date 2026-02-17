[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / TrimWhitespace

# Type Alias: TrimWhitespace\<S\>

> **TrimWhitespace**\<`S`\> = `S` *extends* `` ` ${infer Rest}` `` ? `TrimWhitespace`\<`Rest`\> : `S` *extends* `` `${infer Rest} ` `` ? `TrimWhitespace`\<`Rest`\> : `S`

Defined in: [src/ui.ts:13](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/ui.ts#L13)

## Type Parameters

### S

`S` *extends* `string`
