### Function: bindProperty()

> **bindProperty**\<`E`, `K`\>(`element`, `key`): (`value`) => `void`

Defined in: [src/helpers.ts:41](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/helpers.ts#L41)

Returns a function that sets a DOM property directly on an element.

TypeScript infers `E[K]` from the element type and key, so no explicit type
parameters are needed at call sites.

#### Type Parameters

##### E

`E` *extends* `Element`

##### K

`K` *extends* `string`

#### Parameters

##### element

`E`

Target element

##### key

`K`

Property key to set

#### Returns

Function that sets the property

(`value`) => `void`

#### Since

1.1
