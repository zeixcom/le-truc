### Function: isCollection()

> **isCollection**\<`T`, `S`\>(`value`): `value is Collection<T, S>`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:100

Checks if a value is a Collection signal.

#### Type Parameters

##### T

`T` *extends* `object`

##### S

`S` *extends* [`Signal`](../type-aliases/Signal.md)\<`T`\> = [`Signal`](../type-aliases/Signal.md)\<`T`\>

#### Parameters

##### value

`unknown`

The value to check

#### Returns

`value is Collection<T, S>`

True if the value is a Collection

#### Since

0.17.2
