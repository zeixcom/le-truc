### Function: bindProperty()

> **bindProperty**\<`O`, `K`\>(`object`, `key`): (`value`) => `void`

Defined in: [src/helpers.ts:63](https://github.com/zeixcom/le-truc/blob/9f8170c07a1296b5e43a3511bac7e4da12ade6c7/src/helpers.ts#L63)

Returns a function that sets a DOM property directly on an element.

TypeScript infers `O[K]` from the object type and key, so no explicit type
parameters are needed at call sites.

#### Type Parameters

##### O

`O` *extends* `object`

##### K

`K` *extends* `string`

#### Parameters

##### object

`O`

Target object

##### key

`K`

Property key to set

#### Returns

Function that sets a property

(`value`) => `void`

#### Since

2.0
