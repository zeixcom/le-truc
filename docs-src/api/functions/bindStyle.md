### Function: bindStyle()

> **bindStyle**(`element`, `prop`): [`WatchHandlers`](../type-aliases/WatchHandlers.md)\<`string`\>

Defined in: [src/helpers.ts:141](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/helpers.ts#L141)

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
