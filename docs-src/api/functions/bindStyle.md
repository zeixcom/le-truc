### Function: bindStyle()

> **bindStyle**(`element`, `prop`): [`WatchHandlers`](../type-aliases/WatchHandlers.md)\<`string`\>

Defined in: [src/helpers.ts:141](https://github.com/zeixcom/le-truc/blob/41c579cf74dea25346deb2e44ba0238619c3dcd3/src/helpers.ts#L141)

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
