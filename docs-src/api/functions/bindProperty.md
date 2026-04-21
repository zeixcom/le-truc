### Function: bindProperty()

> **bindProperty**\<`O`, `K`\>(`object`, `key`): (`value`) => `void`

Defined in: [src/helpers.ts:63](https://github.com/zeixcom/le-truc/blob/c5ac50af47ae40f80c1a0a08f969acee81e2622e/src/helpers.ts#L63)

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
