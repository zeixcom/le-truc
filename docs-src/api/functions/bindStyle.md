### Function: bindStyle()

> **bindStyle**(`element`, `prop`): `WatchHandlers`\<`string`\>

Defined in: [src/helpers.ts:140](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/helpers.ts#L140)

Returns `RunHandlers` that set or remove an inline style property.

- `ok(string)` → `el.style.setProperty(prop, value)`
- `nil` → `el.style.removeProperty(prop)`, restoring the CSS cascade value

#### Parameters

##### element

`HTMLElement` \| `SVGElement` \| `MathMLElement`

Target element

##### prop

`string`

CSS property name (e.g. `'color'`, `'--my-var'`)

#### Returns

`WatchHandlers`\<`string`\>

Watch handlers for the style property

#### Since

1.1
