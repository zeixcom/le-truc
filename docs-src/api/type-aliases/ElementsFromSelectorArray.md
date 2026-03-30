### Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:77](https://github.com/zeixcom/le-truc/blob/84654ba213d2f93af20025001d10957b6f1486c9/src/ui.ts#L77)

#### Type Parameters

##### Selectors

`Selectors` *extends* readonly `string`[]
