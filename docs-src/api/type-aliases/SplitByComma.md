### Type Alias: SplitByComma\<S\>

> **SplitByComma**\<`S`\> = `S` *extends* `` `${infer First},${infer Rest}` `` ? \[[`TrimWhitespace`](TrimWhitespace.md)\<`First`\>, `...SplitByComma<Rest>`\] : \[[`TrimWhitespace`](TrimWhitespace.md)\<`S`\>\]

Defined in: [src/helpers/dom.ts:12](https://github.com/zeixcom/le-truc/blob/4745f51b23182fae3c5af6979d02c4ed2b72bcbb/src/helpers/dom.ts#L12)

#### Type Parameters

##### S

`S` *extends* `string`
