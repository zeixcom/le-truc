### Function: bindVisible()

> **bindVisible**\<`T`\>(`element`): (`value`) => `void`

Defined in: [src/bindings.ts:234](https://github.com/zeixcom/le-truc/blob/62831a486b22055e2f0aae8a1bc13f5e79ffdffc/src/bindings.ts#L234)

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
