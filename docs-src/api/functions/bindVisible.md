### Function: bindVisible()

> **bindVisible**\<`T`\>(`element`, `transform?`): (`value`) => `void`

Defined in: [src/helpers.ts:88](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/helpers.ts#L88)

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
