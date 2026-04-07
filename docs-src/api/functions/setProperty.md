### ~~Function: setProperty()~~

> **setProperty**\<`P`, `E`, `K`\>(`key`, `reactive?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/property.ts:16](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/effects/property.ts#L16)

Effect for setting a property on an element.
Sets the specified property directly on the element object.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `Element`

##### K

`K` *extends* `string`

#### Parameters

##### key

`K`

Name of the property to set

##### reactive?

[`Reactive`](../type-aliases/Reactive.md)\<`E`\[`K`\] & `object`, `P`, `E`\> = `...`

Reactive value bound to the property value (defaults to property name)

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that sets the property on the element

#### Deprecated

Use `watch('prop', value => { el.property = value })` in the v1.1 factory form instead.

#### Since

0.8.0
