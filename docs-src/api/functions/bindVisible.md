### Function: bindVisible()

> **bindVisible**(`element`): (`value`) => `void`

Defined in: [src/helpers.ts:76](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/helpers.ts#L76)

Returns a function that controls element visibility via `el.hidden = !value`.

`value=true` makes the element visible; `value=false` hides it.
Matches the direction of the v1.0 `show()` effect.

#### Parameters

##### element

`HTMLElement`

Target element

#### Returns

Function that sets element visibility

(`value`) => `void`

#### Since

1.1
