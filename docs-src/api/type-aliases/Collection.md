### Type Alias: Collection\<T\>

> **Collection**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:19

A read-only reactive keyed collection with per-item reactivity.
Created by `createCollection` (externally driven) or via `.deriveCollection()` on a `List` or `Collection`.

#### Type Parameters

##### T

`T` *extends* `object`

The type of items in the collection

#### Properties

##### \[isConcatSpreadable\]

> `readonly` **\[isConcatSpreadable\]**: `true`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:21

***

##### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"Collection"`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:20

***

##### length

> `readonly` **length**: `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:31

#### Methods

##### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<[`Signal`](Signal.md)\<`T`\>\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:22

###### Returns

`IterableIterator`\<[`Signal`](Signal.md)\<`T`\>\>

***

##### at()

> **at**(`index`): [`Signal`](Signal.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:25

###### Parameters

##### index

`number`

###### Returns

[`Signal`](Signal.md)\<`T`\> \| `undefined`

***

##### byKey()

> **byKey**(`key`): [`Signal`](Signal.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:26

###### Parameters

##### key

`string`

###### Returns

[`Signal`](Signal.md)\<`T`\> \| `undefined`

***

##### deriveCollection()

###### Call Signature

> **deriveCollection**\<`R`\>(`callback`): `Collection`\<`R`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:29

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`) => `R`

##### Returns

`Collection`\<`R`\>

###### Call Signature

> **deriveCollection**\<`R`\>(`callback`): `Collection`\<`R`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:30

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`, `abort`) => `Promise`\<`R`\>

##### Returns

`Collection`\<`R`\>

***

##### get()

> **get**(): `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:24

###### Returns

`T`[]

***

##### indexOfKey()

> **indexOfKey**(`key`): `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:28

###### Parameters

##### key

`string`

###### Returns

`number`

***

##### keyAt()

> **keyAt**(`index`): `string` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:27

###### Parameters

##### index

`number`

###### Returns

`string` \| `undefined`

***

##### keys()

> **keys**(): `IterableIterator`\<`string`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:23

###### Returns

`IterableIterator`\<`string`\>
