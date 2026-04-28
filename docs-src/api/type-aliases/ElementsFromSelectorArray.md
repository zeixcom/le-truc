### Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:77](https://github.com/zeixcom/le-truc/blob/787595f49d798a36c251c9a03383a3033b77ac2b/src/ui.ts#L77)

#### Type Parameters

##### Selectors

`Selectors` *extends* readonly `string`[]
