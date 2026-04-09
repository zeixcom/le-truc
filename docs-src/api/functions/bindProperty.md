### Function: bindProperty()

> **bindProperty**\<`E`, `K`\>(`element`, `key`): (`value`) => `void`

Defined in: [src/helpers.ts:42](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/helpers.ts#L42)

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
