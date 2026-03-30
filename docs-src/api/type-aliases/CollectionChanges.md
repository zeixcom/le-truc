### Type Alias: CollectionChanges\<T\>

> **CollectionChanges**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:38

Granular mutation descriptor passed to the `applyChanges` callback inside a `CollectionCallback`.

#### Type Parameters

##### T

`T`

The type of items in the collection

#### Properties

##### add?

> `optional` **add?**: `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:40

Items to add. Each item is assigned a new key via the configured `keyConfig`.

***

##### change?

> `optional` **change?**: `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:42

Items whose values have changed. Matched to existing entries by key.

***

##### remove?

> `optional` **remove?**: `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:44

Items to remove. Matched to existing entries by key.
