### Type Alias: ElementFromSelector\<S\>

> **ElementFromSelector**\<`S`\> = `S` *extends* `` `${string},${string}` `` ? [`ElementsFromSelectorArray`](ElementsFromSelectorArray.md)\<[`SplitByComma`](SplitByComma.md)\<`S`\>\> : [`ElementFromSingleSelector`](ElementFromSingleSelector.md)\<`S`\>

Defined in: [src/helpers/dom.ts:88](https://github.com/zeixcom/le-truc/blob/7e0fa7978a962570b404d9891000511e41ab8eb9/src/helpers/dom.ts#L88)

#### Type Parameters

##### S

`S` *extends* `string`
