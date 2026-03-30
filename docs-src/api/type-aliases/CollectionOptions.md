### Type Alias: CollectionOptions\<T\>

> **CollectionOptions**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:51

Configuration options for `createCollection`.

#### Type Parameters

##### T

`T` *extends* `object`

The type of items in the collection

#### Properties

##### createItem?

> `optional` **createItem?**: (`value`) => [`Signal`](Signal.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:57

Factory for per-item signals. Defaults to `createState`.

###### Parameters

##### value

`T`

###### Returns

[`Signal`](Signal.md)\<`T`\>

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
