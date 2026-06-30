### Function: bindProperty()

> **bindProperty**\<`O`, `K`\>(`object`, `key`): (`value`) => `void`

Defined in: [src/bindings.ts:201](https://github.com/zeixcom/le-truc/blob/a00a78f0ec81c853d59278f25a4fb2f3f3684691/src/bindings.ts#L201)

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
