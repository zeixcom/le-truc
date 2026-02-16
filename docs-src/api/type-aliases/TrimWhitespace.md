[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / TrimWhitespace

# Type Alias: TrimWhitespace\<S\>

> **TrimWhitespace**\<`S`\> = `S` *extends* `` ` ${infer Rest}` `` ? `TrimWhitespace`\<`Rest`\> : `S` *extends* `` `${infer Rest} ` `` ? `TrimWhitespace`\<`Rest`\> : `S`

Defined in: [src/ui.ts:13](https://github.com/zeixcom/le-truc/blob/c62468fd9c5d5c7240f34b9daac5034cede67a90/src/ui.ts#L13)

## Type Parameters

### S

`S` *extends* `string`
