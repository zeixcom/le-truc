### Function: bindClass()

> **bindClass**\<`T`\>(`element`, `token`): (`value`) => `void`

Defined in: [src/bindings.ts:214](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/bindings.ts#L214)

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
