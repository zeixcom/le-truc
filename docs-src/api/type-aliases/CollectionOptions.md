### Type Alias: CollectionOptions\<T, S\>

> **CollectionOptions**\<`T`, `S`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:51

Configuration options for `createCollection`.

#### Type Parameters

##### T

`T` *extends* `object`

The type of items in the collection

##### S

`S` *extends* [`Signal`](Signal.md)\<`T`\> = [`Signal`](Signal.md)\<`T`\>

#### Properties

##### createItem?

> `optional` **createItem?**: (`value`) => `S`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:57

Factory for per-item signals. Defaults to `createState`.

###### Parameters

##### value

`T`

###### Returns

`S`

***

##### itemEquals?

> `optional` **itemEquals?**: (`a`, `b`) => `boolean`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:59

Equality function for default item state signals. Defaults to deep equality. Ignored if `createItem` is provided.

###### Parameters

##### a

`T`

##### b

`T`

###### Returns

`boolean`

***

##### keyConfig?

> `optional` **keyConfig?**: `KeyConfig`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:55

Key generation strategy. See `KeyConfig`. Defaults to auto-increment.

***

##### value?

> `optional` **value?**: `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:53

Initial items. Defaults to `[]`.
