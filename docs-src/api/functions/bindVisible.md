### Function: bindVisible()

> **bindVisible**\<`T`\>(`element`): (`value`) => `void`

Defined in: [src/helpers.ts:77](https://github.com/zeixcom/le-truc/blob/90149bb8885c2e678e7571c228e4005108709147/src/helpers.ts#L77)

Returns a function that controls element visibility via `el.hidden = !value`.

`value=true` makes the element visible; `value=false` hides it.
Matches the direction of the v1.0 `show()` effect.

#### Type Parameters

##### T

`T` = `boolean`

#### Parameters

##### element

`HTMLElement`

Target element

#### Returns

Function that sets element visibility

(`value`) => `void`

#### Since

2.0
