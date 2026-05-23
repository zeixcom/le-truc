### Function: bindStyle()

> **bindStyle**(`element`, `prop`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string`\>

Defined in: [src/bindings.ts:236](https://github.com/zeixcom/le-truc/blob/8b1a8f8a0600ebb21b0e3c25fa43e088d951188e/src/bindings.ts#L236)

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
