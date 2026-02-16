[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / SplitByComma

# Type Alias: SplitByComma\<S\>

> **SplitByComma**\<`S`\> = `S` *extends* `` `${infer First},${infer Rest}` `` ? \[[`TrimWhitespace`](TrimWhitespace.md)\<`First`\>, `...SplitByComma<Rest>`\] : \[[`TrimWhitespace`](TrimWhitespace.md)\<`S`\>\]

Defined in: [src/ui.ts:8](https://github.com/zeixcom/le-truc/blob/c62468fd9c5d5c7240f34b9daac5034cede67a90/src/ui.ts#L8)

## Type Parameters

### S

`S` *extends* `string`
