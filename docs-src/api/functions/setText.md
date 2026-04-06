### ~~Function: setText()~~

> **setText**\<`P`, `E`\>(`reactive`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/text.ts:15](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects/text.ts#L15)

Effect for setting the text content of an element.
Replaces all child nodes (except comments) with a single text node.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `Element`

#### Parameters

##### reactive

[`Reactive`](../type-aliases/Reactive.md)\<`string`, `P`, `E`\>

Reactive value bound to the text content

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that sets the text content of the element

#### Deprecated

Use `watch('prop', value => { el.textContent = value })` in the v1.1 factory form instead.

#### Since

0.8.0
