### Function: bindStyle()

> **bindStyle**(`element`, `prop`): [`WatchHandlers`](../type-aliases/WatchHandlers.md)\<`string`\>

Defined in: [src/helpers.ts:127](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/helpers.ts#L127)

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
