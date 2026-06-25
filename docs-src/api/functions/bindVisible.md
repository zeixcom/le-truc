### Function: bindVisible()

> **bindVisible**\<`T`\>(`element`): (`value`) => `void`

Defined in: [src/bindings.ts:229](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/bindings.ts#L229)

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
