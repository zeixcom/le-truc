### Type Alias: SplitByComma\<S\>

> **SplitByComma**\<`S`\> = `S` *extends* `` `${infer First},${infer Rest}` `` ? \[[`TrimWhitespace`](TrimWhitespace.md)\<`First`\>, `...SplitByComma<Rest>`\] : \[[`TrimWhitespace`](TrimWhitespace.md)\<`S`\>\]

Defined in: [src/helpers/dom.ts:12](https://github.com/zeixcom/le-truc/blob/e4b36bb40c21ae6929a612c7380070be96eead21/src/helpers/dom.ts#L12)

#### Type Parameters

##### S

`S` *extends* `string`
