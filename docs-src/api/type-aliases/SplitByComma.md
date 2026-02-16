[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / SplitByComma

# Type Alias: SplitByComma\<S\>

> **SplitByComma**\<`S`\> = `S` *extends* `` `${infer First},${infer Rest}` `` ? \[[`TrimWhitespace`](TrimWhitespace.md)\<`First`\>, `...SplitByComma<Rest>`\] : \[[`TrimWhitespace`](TrimWhitespace.md)\<`S`\>\]

Defined in: [src/ui.ts:8](https://github.com/zeixcom/le-truc/blob/9067b0df4b01434796accabfb262c9896f05f14f/src/ui.ts#L8)

## Type Parameters

### S

`S` *extends* `string`
