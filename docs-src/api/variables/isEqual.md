[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / isEqual

# Variable: isEqual()

> `const` **isEqual**: \<`T`\>(`a`, `b`, `visited?`) => `boolean`

Defined in: node\_modules/@zeix/cause-effect/types/src/diff.d.ts:22

Checks if two values are equal with cycle detection

## Type Parameters

### T

`T`

## Parameters

### a

`T`

First value to compare

### b

`T`

Second value to compare

### visited?

`WeakSet`\<`object`\>

Set to track visited objects for cycle detection

## Returns

`boolean`

Whether the two values are equal

## Since

0.15.0
