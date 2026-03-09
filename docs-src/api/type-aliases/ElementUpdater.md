### Type Alias: ElementUpdater\<E, T\>

> **ElementUpdater**\<`E`, `T`\> = `object`

Defined in: [src/effects.ts:94](https://github.com/zeixcom/le-truc/blob/2572527650262b9f6697a458b486f766495416eb/src/effects.ts#L94)

Descriptor passed to `updateElement` that defines how to read, update, and
optionally delete a single DOM property or attribute.

- `read` — captures the current DOM value as the fallback at setup time.
- `update` — called with the resolved reactive value when it changes.
- `delete` — called when the reactive returns `null` (removes the value).
- `resolve` / `reject` — optional lifecycle hooks for debug instrumentation.

#### Type Parameters

##### E

`E` *extends* `Element`

##### T

`T`

#### Properties

##### delete()?

> `optional` **delete**: (`element`) => `void`

Defined in: [src/effects.ts:99](https://github.com/zeixcom/le-truc/blob/2572527650262b9f6697a458b486f766495416eb/src/effects.ts#L99)

###### Parameters

##### element

`E`

###### Returns

`void`

***

##### name?

> `optional` **name**: `string`

Defined in: [src/effects.ts:96](https://github.com/zeixcom/le-truc/blob/2572527650262b9f6697a458b486f766495416eb/src/effects.ts#L96)

***

##### op

> **op**: [`UpdateOperation`](UpdateOperation.md)

Defined in: [src/effects.ts:95](https://github.com/zeixcom/le-truc/blob/2572527650262b9f6697a458b486f766495416eb/src/effects.ts#L95)

***

##### read()

> **read**: (`element`) => `T` \| `null`

Defined in: [src/effects.ts:97](https://github.com/zeixcom/le-truc/blob/2572527650262b9f6697a458b486f766495416eb/src/effects.ts#L97)

###### Parameters

##### element

`E`

###### Returns

`T` \| `null`

***

##### reject()?

> `optional` **reject**: (`error`) => `void`

Defined in: [src/effects.ts:101](https://github.com/zeixcom/le-truc/blob/2572527650262b9f6697a458b486f766495416eb/src/effects.ts#L101)

###### Parameters

##### error

`unknown`

###### Returns

`void`

***

##### resolve()?

> `optional` **resolve**: (`element`) => `void`

Defined in: [src/effects.ts:100](https://github.com/zeixcom/le-truc/blob/2572527650262b9f6697a458b486f766495416eb/src/effects.ts#L100)

###### Parameters

##### element

`E`

###### Returns

`void`

***

##### update()

> **update**: (`element`, `value`) => `void`

Defined in: [src/effects.ts:98](https://github.com/zeixcom/le-truc/blob/2572527650262b9f6697a458b486f766495416eb/src/effects.ts#L98)

###### Parameters

##### element

`E`

##### value

`T`

###### Returns

`void`
