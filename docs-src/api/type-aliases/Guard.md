### Type Alias: Guard()\<T\>

> **Guard**\<`T`\> = (`value`) => `value is T`

Defined in: node\_modules/@zeix/cause-effect/types/src/errors.d.ts:9

A type guard function that validates whether an unknown value is of type T.
Used to ensure type safety when updating signals.

#### Type Parameters

##### T

`T` *extends* `object`

The type to guard against

#### Parameters

##### value

`unknown`

The value to check

#### Returns

`value is T`

True if the value is of type T
