### Function: setStyle()

> **setStyle**\<`P`, `E`\>(`prop`, `reactive?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/style.ts:17](https://github.com/zeixcom/le-truc/blob/cbc935087cbb74b599ebc3d8a11ba560b180d4b1/src/effects/style.ts#L17)

Effect for setting a CSS custom property or inline style on an element.

When the reactive value is `null`, the style property is removed via
`el.style.removeProperty(prop)`. Otherwise it is set via `el.style.setProperty(prop, value)`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `HTMLElement` \| `SVGElement` \| `MathMLElement`

#### Parameters

##### prop

`string`

CSS property name (e.g. `'color'`, `'--my-var'`)

##### reactive?

[`Reactive`](../type-aliases/Reactive.md)\<`string`, `P`, `E`\> = `...`

Reactive value for the style value (defaults to property name)

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect that sets or removes the style property on the element

#### Since

0.8.0
