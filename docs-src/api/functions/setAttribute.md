### Function: setAttribute()

> **setAttribute**\<`P`, `E`\>(`name`, `reactive?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/attribute.ts:47](https://github.com/zeixcom/le-truc/blob/2cea8afdd3d4dfbc6a9eee6db9acf561d507d360/src/effects/attribute.ts#L47)

Effect for setting an attribute on an element.
Sets the specified attribute with security validation for unsafe values.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `Element`

#### Parameters

##### name

`string`

Name of the attribute to set

##### reactive?

[`Reactive`](../type-aliases/Reactive.md)\<`string`, `P`, `E`\> = `...`

Reactive value bound to the attribute value (defaults to attribute name)

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that sets the attribute on the element

#### Since

0.8.0
