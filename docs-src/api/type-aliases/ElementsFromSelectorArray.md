### Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:77](https://github.com/zeixcom/le-truc/blob/53281ff4634318c8e0964232bafee60d7a1ccdb2/src/ui.ts#L77)

#### Type Parameters

##### Selectors

`Selectors` *extends* readonly `string`[]
