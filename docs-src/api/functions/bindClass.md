### Function: bindClass()

> **bindClass**\<`T`\>(`element`, `token`, `transform?`): (`value`) => `void`

Defined in: [src/helpers.ts:63](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/helpers.ts#L63)

Returns a function that toggles a CSS class token on an element.

`value=true` adds the token; `value=false` removes it.
If `transform` is provided, it converts the incoming value to a boolean first.

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

##### transform?

(`value`) => `boolean`

Optional function to derive a boolean from the value

#### Returns

Function that toggles the class

(`value`) => `void`

#### Since

2.0
