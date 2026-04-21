### Function: bindClass()

> **bindClass**\<`T`\>(`element`, `token`): (`value`) => `void`

Defined in: [src/helpers.ts:82](https://github.com/zeixcom/le-truc/blob/3d378e339ca819861372f356f408d3d000b2c62c/src/helpers.ts#L82)

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

Function that toggles the class token

(`value`) => `void`

#### Since

2.0
