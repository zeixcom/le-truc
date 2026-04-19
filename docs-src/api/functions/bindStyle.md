### Function: bindStyle()

> **bindStyle**(`element`, `prop`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Defined in: [src/helpers.ts:147](https://github.com/zeixcom/le-truc/blob/1fbe7a16df53520ae334ded40a50f57cafc83af1/src/helpers.ts#L147)

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
