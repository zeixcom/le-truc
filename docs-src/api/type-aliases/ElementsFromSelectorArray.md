[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ElementsFromSelectorArray

# Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:70](https://github.com/zeixcom/le-truc/blob/d14510e550dfc154f9f0472e7b8adcdb3ab3002e/src/ui.ts#L70)

## Type Parameters

### Selectors

`Selectors` *extends* readonly `string`[]
