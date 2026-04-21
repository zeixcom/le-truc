### Function: bindVisible()

> **bindVisible**\<`T`\>(`element`): (`value`) => `void`

Defined in: [src/helpers.ts:97](https://github.com/zeixcom/le-truc/blob/c5ac50af47ae40f80c1a0a08f969acee81e2622e/src/helpers.ts#L97)

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
