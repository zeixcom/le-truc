### Type Alias: ElementFromSelector\<S\>

> **ElementFromSelector**\<`S`\> = `S` *extends* `` `${string},${string}` `` ? [`ElementsFromSelectorArray`](ElementsFromSelectorArray.md)\<[`SplitByComma`](SplitByComma.md)\<`S`\>\> : [`ElementFromSingleSelector`](ElementFromSingleSelector.md)\<`S`\>

Defined in: [src/helpers/dom.ts:84](https://github.com/zeixcom/le-truc/blob/157db2ea6a0d3aea197ee178eec89f5cb4064479/src/helpers/dom.ts#L84)

#### Type Parameters

##### S

`S` *extends* `string`
