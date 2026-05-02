### Function: bindProperty()

> **bindProperty**\<`O`, `K`\>(`object`, `key`): (`value`) => `void`

Defined in: [src/bindings.ts:152](https://github.com/zeixcom/le-truc/blob/c0c7a519683b9de6742fb7ca8d71487ad2dadceb/src/bindings.ts#L152)

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
