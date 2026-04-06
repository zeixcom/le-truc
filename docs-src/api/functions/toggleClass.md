### ~~Function: toggleClass()~~

> **toggleClass**\<`P`, `E`\>(`token`, `reactive?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/class.ts:16](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects/class.ts#L16)

Effect for toggling a CSS class token on an element.
When the reactive value is true, the class is added; when false, it's removed.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `Element`

#### Parameters

##### token

`string`

CSS class token to toggle

##### reactive?

[`Reactive`](../type-aliases/Reactive.md)\<`boolean`, `P`, `E`\> = `...`

Reactive value bound to the class presence (defaults to class name)

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect that toggles the class on the element

#### Deprecated

Use `watch('prop', value => { el.classList.toggle(token, value) })` in the v1.1 factory form instead.

#### Since

0.8.0
