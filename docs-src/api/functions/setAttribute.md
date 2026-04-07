### ~~Function: setAttribute()~~

> **setAttribute**\<`P`, `E`\>(`name`, `reactive?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/attribute.ts:18](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/effects/attribute.ts#L18)

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

#### Deprecated

Use `watch('prop', value => { el.setAttribute(name, value) })` in the v1.1 factory form instead.
`safeSetAttribute(el, name, value)` is available for security-validated attribute writes.

#### Since

0.8.0
