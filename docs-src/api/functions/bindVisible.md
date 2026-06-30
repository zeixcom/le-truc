### Function: bindVisible()

> **bindVisible**\<`T`\>(`element`): (`value`) => `void`

Defined in: [src/bindings.ts:235](https://github.com/zeixcom/le-truc/blob/30c663d93493e8bfde66b92544a0c454cb99d1a1/src/bindings.ts#L235)

Returns a function that controls element visibility via `el.hidden = !value`.

`value=true` makes the element visible; `value=false` hides it.

#### Type Parameters

##### T

`T` = `boolean`

#### Parameters

##### element

`HTMLElement`

Target element

#### Returns

Function that schedules the visibility update

(`value`) => `void`

#### Since

2.0
