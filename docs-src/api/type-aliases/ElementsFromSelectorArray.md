### Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/helpers/dom.ts:81](https://github.com/zeixcom/le-truc/blob/4745f51b23182fae3c5af6979d02c4ed2b72bcbb/src/helpers/dom.ts#L81)

#### Type Parameters

##### Selectors

`Selectors` *extends* readonly `string`[]
