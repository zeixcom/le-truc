### ~~Function: toggleAttribute()~~

> **toggleAttribute**\<`P`, `E`\>(`name`, `reactive?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/attribute.ts:44](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects/attribute.ts#L44)

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

#### Deprecated

Use `run('prop', value => { el.toggleAttribute(name, value) })` in the v1.1 factory form instead.

#### Since

0.8.0
