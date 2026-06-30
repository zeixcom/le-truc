### Type Alias: ElementFromSelector\<S\>

> **ElementFromSelector**\<`S`\> = `S` *extends* `` `${string},${string}` `` ? [`ElementsFromSelectorArray`](ElementsFromSelectorArray.md)\<[`SplitByComma`](SplitByComma.md)\<`S`\>\> : [`ElementFromSingleSelector`](ElementFromSingleSelector.md)\<`S`\>

Defined in: [src/helpers/dom.ts:88](https://github.com/zeixcom/le-truc/blob/30c663d93493e8bfde66b92544a0c454cb99d1a1/src/helpers/dom.ts#L88)

#### Type Parameters

##### S

`S` *extends* `string`
