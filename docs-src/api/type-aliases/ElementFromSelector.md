### Type Alias: ElementFromSelector\<S\>

> **ElementFromSelector**\<`S`\> = `S` *extends* `` `${string},${string}` `` ? [`ElementsFromSelectorArray`](ElementsFromSelectorArray.md)\<[`SplitByComma`](SplitByComma.md)\<`S`\>\> : [`ElementFromSingleSelector`](ElementFromSingleSelector.md)\<`S`\>

Defined in: [src/helpers/dom.ts:88](https://github.com/zeixcom/le-truc/blob/2ffb1c502ebab484378e3307067208fa92666c97/src/helpers/dom.ts#L88)

#### Type Parameters

##### S

`S` *extends* `string`
