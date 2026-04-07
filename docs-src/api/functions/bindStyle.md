### Function: bindStyle()

> **bindStyle**(`element`, `prop`): `WatchHandlers`\<`string`\>

Defined in: [src/helpers.ts:141](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/helpers.ts#L141)

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

2.0
