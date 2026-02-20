### Function: setStyle()

> **setStyle**\<`P`, `E`\>(`prop`, `reactive?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/style.ts:15](https://github.com/zeixcom/le-truc/blob/9bf1182113652328495f1c47a23356331bfe23f3/src/effects/style.ts#L15)

Effect for setting a CSS style property on an element.
Sets the specified style property with support for deletion via UNSET.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `HTMLElement` \| `SVGElement` \| `MathMLElement`

#### Parameters

##### prop

`string`

Name of the CSS style property to set

##### reactive?

[`Reactive`](../type-aliases/Reactive.md)\<`string`, `P`, `E`\> = `...`

Reactive value bound to the style property value (defaults to property name)

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that sets the style property on the element

#### Since

0.8.0
