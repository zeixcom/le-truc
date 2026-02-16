[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ElementsFromSelectorArray

# Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:70](https://github.com/zeixcom/le-truc/blob/c62468fd9c5d5c7240f34b9daac5034cede67a90/src/ui.ts#L70)

## Type Parameters

### Selectors

`Selectors` *extends* readonly `string`[]
