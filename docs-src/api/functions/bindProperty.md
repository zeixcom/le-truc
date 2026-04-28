### Function: bindProperty()

> **bindProperty**\<`O`, `K`\>(`object`, `key`): (`value`) => `void`

Defined in: [src/helpers.ts:63](https://github.com/zeixcom/le-truc/blob/787595f49d798a36c251c9a03383a3033b77ac2b/src/helpers.ts#L63)

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
