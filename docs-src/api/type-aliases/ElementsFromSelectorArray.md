[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ElementsFromSelectorArray

# Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:70](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/ui.ts#L70)

## Type Parameters

### Selectors

`Selectors` *extends* readonly `string`[]
