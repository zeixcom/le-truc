[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / SplitByComma

# Type Alias: SplitByComma\<S\>

> **SplitByComma**\<`S`\> = `S` *extends* `` `${infer First},${infer Rest}` `` ? \[[`TrimWhitespace`](TrimWhitespace.md)\<`First`\>, `...SplitByComma<Rest>`\] : \[[`TrimWhitespace`](TrimWhitespace.md)\<`S`\>\]

Defined in: [src/ui.ts:8](https://github.com/zeixcom/le-truc/blob/d0a4e93f3ca0be0a72dba7eef0d44a002f024ef7/src/ui.ts#L8)

## Type Parameters

### S

`S` *extends* `string`
