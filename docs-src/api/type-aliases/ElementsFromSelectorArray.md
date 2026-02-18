[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ElementsFromSelectorArray

# Type Alias: ElementsFromSelectorArray\<Selectors\>

> **ElementsFromSelectorArray**\<`Selectors`\> = `{ [K in keyof Selectors]: Selectors[K] extends string ? ElementFromSingleSelector<Selectors[K]> : never }`\[`number`\]

Defined in: [src/ui.ts:70](https://github.com/zeixcom/le-truc/blob/5c30877fa2fce96dab1ef679e495da98511e97d7/src/ui.ts#L70)

## Type Parameters

### Selectors

`Selectors` *extends* readonly `string`[]
