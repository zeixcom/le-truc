### Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:77](https://github.com/zeixcom/le-truc/blob/9f8170c07a1296b5e43a3511bac7e4da12ade6c7/src/ui.ts#L77)

#### Type Parameters

##### Selectors

`Selectors` *extends* readonly `string`[]
