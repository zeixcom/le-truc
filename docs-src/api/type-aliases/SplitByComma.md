[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / SplitByComma

# Type Alias: SplitByComma\<S\>

> **SplitByComma**\<`S`\> = `S` *extends* `` `${infer First},${infer Rest}` `` ? \[[`TrimWhitespace`](TrimWhitespace.md)\<`First`\>, `...SplitByComma<Rest>`\] : \[[`TrimWhitespace`](TrimWhitespace.md)\<`S`\>\]

Defined in: [src/ui.ts:8](https://github.com/zeixcom/le-truc/blob/29df9dc153407528423acb370c4f28ebc628bed2/src/ui.ts#L8)

## Type Parameters

### S

`S` *extends* `string`
