### Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:70](https://github.com/zeixcom/le-truc/blob/b2bd37a6fe13095f4a2fd459382f54953f446e56/src/ui.ts#L70)

#### Type Parameters

##### Selectors

`Selectors` *extends* readonly `string`[]
