### Function: toggleClass()

> **toggleClass**\<`P`, `E`\>(`token`, `reactive?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/class.ts:15](https://github.com/zeixcom/le-truc/blob/d3151c8acd4577999007fad73e21cf0cc45337e4/src/effects/class.ts#L15)

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

#### Since

0.8.0
