[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ElementsFromSelectorArray

# Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:70](https://github.com/zeixcom/le-truc/blob/29df9dc153407528423acb370c4f28ebc628bed2/src/ui.ts#L70)

## Type Parameters

### Selectors

`Selectors` *extends* readonly `string`[]
