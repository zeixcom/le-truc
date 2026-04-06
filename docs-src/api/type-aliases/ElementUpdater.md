### Type Alias: ElementUpdater\<E, T\>

> **ElementUpdater**\<`E`, `T`\> = `object`

Defined in: [src/effects.ts:113](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L113)

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

##### delete?

> `optional` **delete?**: (`element`) => `void`

Defined in: [src/effects.ts:118](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L118)

###### Parameters

##### element

`E`

###### Returns

`void`

***

##### name?

> `optional` **name?**: `string`

Defined in: [src/effects.ts:115](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L115)

***

##### op

> **op**: [`UpdateOperation`](UpdateOperation.md)

Defined in: [src/effects.ts:114](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L114)

***

##### read

> **read**: (`element`) => `T` \| `null`

Defined in: [src/effects.ts:116](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L116)

###### Parameters

##### element

`E`

###### Returns

`T` \| `null`

***

##### reject?

> `optional` **reject?**: (`error`) => `void`

Defined in: [src/effects.ts:120](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L120)

###### Parameters

##### error

`unknown`

###### Returns

`void`

***

##### resolve?

> `optional` **resolve?**: (`element`) => `void`

Defined in: [src/effects.ts:119](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L119)

###### Parameters

##### element

`E`

###### Returns

`void`

***

##### update

> **update**: (`element`, `value`) => `void`

Defined in: [src/effects.ts:117](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L117)

###### Parameters

##### element

`E`

##### value

`T`

###### Returns

`void`
