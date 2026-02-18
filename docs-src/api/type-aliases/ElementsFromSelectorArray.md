### Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:70](https://github.com/zeixcom/le-truc/blob/9899f5d34ea29fc1973736236835ba462d0ed87a/src/ui.ts#L70)

#### Type Parameters

##### Selectors

`Selectors` *extends* readonly `string`[]
