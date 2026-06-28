### Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/helpers/dom.ts:81](https://github.com/zeixcom/le-truc/blob/4098d5791c279825fcbaa4a549a14c3639e84375/src/helpers/dom.ts#L81)

#### Type Parameters

##### Selectors

`Selectors` *extends* readonly `string`[]
