### ~~Function: show()~~

> **show**\<`P`, `E`\>(`reactive`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/property.ts:42](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects/property.ts#L42)

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

#### Deprecated

Use `run('prop', value => { el.hidden = !value })` in the v1.1 factory form instead.

#### Since

0.13.1
