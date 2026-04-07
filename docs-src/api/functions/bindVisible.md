### Function: bindVisible()

> **bindVisible**\<`T`\>(`element`, `transform?`): (`value`) => `void`

Defined in: [src/helpers.ts:88](https://github.com/zeixcom/le-truc/blob/6e56893b2946c17dd4fe36c76f1a09d8d1d02488/src/helpers.ts#L88)

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
