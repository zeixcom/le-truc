### Type Alias: SplitByComma\<S\>

> **SplitByComma**\<`S`\> = `S` *extends* `` `${infer First},${infer Rest}` `` ? \[[`TrimWhitespace`](TrimWhitespace.md)\<`First`\>, `...SplitByComma<Rest>`\] : \[[`TrimWhitespace`](TrimWhitespace.md)\<`S`\>\]

Defined in: [src/helpers/dom.ts:12](https://github.com/zeixcom/le-truc/blob/62831a486b22055e2f0aae8a1bc13f5e79ffdffc/src/helpers/dom.ts#L12)

#### Type Parameters

##### S

`S` *extends* `string`
