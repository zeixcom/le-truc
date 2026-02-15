[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / SignalOptions

# Type Alias: SignalOptions\<T\>

> **SignalOptions**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:60

Options for configuring signal behavior.

## Type Parameters

### T

`T` *extends* `object`

The type of value in the signal

## Properties

### equals()?

> `optional` **equals**: (`a`, `b`) => `boolean`

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:71

Optional custom equality function.
Used to determine if a new value is different from the old value.
Defaults to reference equality (===).

#### Parameters

##### a

`T`

##### b

`T`

#### Returns

`boolean`

***

### guard?

> `optional` **guard**: `Guard`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:65

Optional type guard to validate values.
If provided, will throw an error if an invalid value is set.
