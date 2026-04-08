### Function: bindClass()

> **bindClass**\<`T`\>(`element`, `token`, `transform?`): (`value`) => `void`

Defined in: [src/helpers.ts:63](https://github.com/zeixcom/le-truc/blob/64495a8246bdcc3ad970b9cd968208c864711df0/src/helpers.ts#L63)

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
