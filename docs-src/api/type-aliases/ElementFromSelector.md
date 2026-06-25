### Type Alias: ElementFromSelector\<S\>

> **ElementFromSelector**\<`S`\> = `S` *extends* `` `${string},${string}` `` ? [`ElementsFromSelectorArray`](ElementsFromSelectorArray.md)\<[`SplitByComma`](SplitByComma.md)\<`S`\>\> : [`ElementFromSingleSelector`](ElementFromSingleSelector.md)\<`S`\>

Defined in: [src/helpers/dom.ts:88](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/helpers/dom.ts#L88)

#### Type Parameters

##### S

`S` *extends* `string`
