### Function: bindStyle()

> **bindStyle**(`element`, `prop`): [`WatchHandlers`](../type-aliases/WatchHandlers.md)\<`string`\>

Defined in: [src/helpers.ts:141](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/helpers.ts#L141)

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

[`WatchHandlers`](../type-aliases/WatchHandlers.md)\<`string`\>

Watch handlers for the style property

#### Since

2.0
