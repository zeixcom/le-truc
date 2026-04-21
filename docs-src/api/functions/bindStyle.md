### Function: bindStyle()

> **bindStyle**(`element`, `prop`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Defined in: [src/helpers.ts:147](https://github.com/zeixcom/le-truc/blob/56101c7b29abec1b313b7eb357a8db22a4da0ef6/src/helpers.ts#L147)

Returns `SingleMatchHandlers<string>` that set or remove an inline style property.

- `ok(string)` → schedules `el.style.setProperty(prop, value)`
- `nil` → schedules `el.style.removeProperty(prop)`, restoring the CSS cascade value

#### Parameters

##### element

`HTMLElement` \| `SVGElement` \| `MathMLElement`

Target element

##### prop

`string`

CSS property name (e.g. `'color'`, `'--my-var'`)

#### Returns

[`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Match handlers for the style mutation

#### Since

2.0
