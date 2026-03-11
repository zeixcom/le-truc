### Function: show()

> **show**\<`P`, `E`\>(`reactive`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/property.ts:40](https://github.com/zeixcom/le-truc/blob/57d2b0db1f6c756c7b3c7143d93400fec84a7617/src/effects/property.ts#L40)

Effect for controlling element visibility by setting the 'hidden' property.
When the reactive value is true, the element is shown; when false, it's hidden.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `HTMLElement` = `HTMLElement`

#### Parameters

##### reactive

[`Reactive`](../type-aliases/Reactive.md)\<`boolean`, `P`, `E`\>

Reactive value bound to the visibility state

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that controls element visibility

#### Since

0.13.1
