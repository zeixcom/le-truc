### Type Alias: SplitByComma\<S\>

> **SplitByComma**\<`S`\> = `S` *extends* `` `${infer First},${infer Rest}` `` ? \[[`TrimWhitespace`](TrimWhitespace.md)\<`First`\>, `...SplitByComma<Rest>`\] : \[[`TrimWhitespace`](TrimWhitespace.md)\<`S`\>\]

Defined in: [src/ui.ts:8](https://github.com/zeixcom/le-truc/blob/3386ff28c36c911ef6de374d52dbcc7da589393b/src/ui.ts#L8)

#### Type Parameters

##### S

`S` *extends* `string`
