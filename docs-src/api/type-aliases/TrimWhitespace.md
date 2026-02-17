[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / TrimWhitespace

# Type Alias: TrimWhitespace\<S\>

> **TrimWhitespace**\<`S`\> = `S` *extends* `` ` ${infer Rest}` `` ? `TrimWhitespace`\<`Rest`\> : `S` *extends* `` `${infer Rest} ` `` ? `TrimWhitespace`\<`Rest`\> : `S`

Defined in: [src/ui.ts:13](https://github.com/zeixcom/le-truc/blob/755557440db1d4332483c0516277bf183e3ff944/src/ui.ts#L13)

## Type Parameters

### S

`S` *extends* `string`
