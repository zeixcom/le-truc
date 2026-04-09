### Function: bindVisible()

> **bindVisible**\<`T`\>(`element`, `transform?`): (`value`) => `void`

Defined in: [src/helpers.ts:88](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/helpers.ts#L88)

Returns a function that controls element visibility via `el.hidden = !value`.

`value=true` makes the element visible; `value=false` hides it.
Matches the direction of the v1.0 `show()` effect.
If `transform` is provided, it converts the incoming value to a boolean first.

#### Type Parameters

##### T

`T` = `boolean`

#### Parameters

##### element

`HTMLElement`

Target element

##### transform?

(`value`) => `boolean`

Optional function to derive a boolean from the value

#### Returns

Function that sets element visibility

(`value`) => `void`

#### Since

2.0
