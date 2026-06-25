### Function: bindStyle()

> **bindStyle**(`element`, `prop`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Defined in: [src/bindings.ts:279](https://github.com/zeixcom/le-truc/blob/2ffb1c502ebab484378e3307067208fa92666c97/src/bindings.ts#L279)

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
