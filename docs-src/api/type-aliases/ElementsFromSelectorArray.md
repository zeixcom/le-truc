### Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:70](https://github.com/zeixcom/le-truc/blob/e24d2793804f24d536ad713492cc94d3689bbbde/src/ui.ts#L70)

#### Type Parameters

##### Selectors

`Selectors` *extends* readonly `string`[]
