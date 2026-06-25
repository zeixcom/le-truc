### Function: bindClass()

> **bindClass**\<`T`\>(`element`, `token`): (`value`) => `void`

Defined in: [src/bindings.ts:214](https://github.com/zeixcom/le-truc/blob/db6b1a1848573cd9da112abcb4d5e3ad31b37308/src/bindings.ts#L214)

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
