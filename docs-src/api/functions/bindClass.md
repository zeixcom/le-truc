### Function: bindClass()

> **bindClass**\<`T`\>(`element`, `token`): (`value`) => `void`

Defined in: [src/helpers.ts:61](https://github.com/zeixcom/le-truc/blob/351fe6de1fcacfd814112a86c890ce84f0ea57f3/src/helpers.ts#L61)

Returns a function that toggles a CSS class token on an element.

`value=true` adds the token; `value=false` removes it.

#### Type Parameters

##### T

`T` = `boolean`

#### Parameters

##### element

`Element`

Target element

##### token

`string`

CSS class token to toggle

#### Returns

Function that toggles the class

(`value`) => `void`

#### Since

2.0
