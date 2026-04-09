### Function: bindProperty()

> **bindProperty**\<`E`, `K`\>(`element`, `key`): (`value`) => `void`

Defined in: [src/helpers.ts:42](https://github.com/zeixcom/le-truc/blob/41c579cf74dea25346deb2e44ba0238619c3dcd3/src/helpers.ts#L42)

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

2.0
