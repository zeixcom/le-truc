### Function: bindStyle()

> **bindStyle**(`element`, `prop`): `WatchHandlers`\<`string`\>

Defined in: [src/helpers.ts:126](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/helpers.ts#L126)

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
