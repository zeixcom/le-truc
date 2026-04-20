### Function: bindStyle()

> **bindStyle**(`element`, `prop`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Defined in: [src/helpers.ts:147](https://github.com/zeixcom/le-truc/blob/0e16726a6b6b9bb6f06cac4d48e841e3343f2b6f/src/helpers.ts#L147)

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
