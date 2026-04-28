### Type Alias: Collection\<T, S\>

> **Collection**\<`T`, `S`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:19

A read-only reactive keyed collection with per-item reactivity.
Created by `createCollection` (externally driven) or via `.deriveCollection()` on a `List` or `Collection`.

#### Type Parameters

##### T

`T` *extends* `object`

The type of items in the collection

##### S

`S` *extends* [`Signal`](Signal.md)\<`T`\> = [`Signal`](Signal.md)\<`T`\>

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

> **\[iterator\]**(): `IterableIterator`\<`S`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:22

###### Returns

`IterableIterator`\<`S`\>

***

##### at()

> **at**(`index`): `S` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:25

###### Parameters

##### index

`number`

###### Returns

`S` \| `undefined`

***

##### byKey()

> **byKey**(`key`): `S` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:26

###### Parameters

##### key

`string`

###### Returns

`S` \| `undefined`

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
