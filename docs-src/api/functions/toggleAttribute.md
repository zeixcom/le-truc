### Function: toggleAttribute()

> **toggleAttribute**\<`P`, `E`\>(`name`, `reactive?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/attribute.ts:72](https://github.com/zeixcom/le-truc/blob/62f34241868753829f1b0628a59b7cbc4dc09d76/src/effects/attribute.ts#L72)

Effect for toggling a boolean attribute on an element.
When the reactive value is true, the attribute is present; when false, it's absent.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `Element` = `HTMLElement`

#### Parameters

##### name

`string`

Name of the attribute to toggle

##### reactive?

[`Reactive`](../type-aliases/Reactive.md)\<`boolean`, `P`, `E`\> = `...`

Reactive value bound to the attribute presence (defaults to attribute name)

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that toggles the attribute on the element

#### Since

0.8.0
