### Function: bindClass()

> **bindClass**\<`T`\>(`element`, `token`): (`value`) => `void`

Defined in: [src/bindings.ts:171](https://github.com/zeixcom/le-truc/blob/3f0de1fb7379c829fde242331bee0885b56a8cd8/src/bindings.ts#L171)

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
