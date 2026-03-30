### Type Alias: List\<T\>

> **List**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:36

A reactive ordered array with stable keys and per-item reactivity.
Each item is a `State<T>` signal; structural changes (add/remove/sort) propagate reactively.

#### Type Parameters

##### T

`T` *extends* `object`

The type of items in the list

#### Properties

##### \[isConcatSpreadable\]

> `readonly` **\[isConcatSpreadable\]**: `true`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:38

***

##### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"List"`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:37

***

##### length

> `readonly` **length**: `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:40

#### Methods

##### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<[`State`](State.md)\<`T`\>\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:39

###### Returns

`IterableIterator`\<[`State`](State.md)\<`T`\>\>

***

##### add()

> **add**(`value`): `string`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:49

###### Parameters

##### value

`T`

###### Returns

`string`

***

##### at()

> **at**(`index`): [`State`](State.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:44

###### Parameters

##### index

`number`

###### Returns

[`State`](State.md)\<`T`\> \| `undefined`

***

##### byKey()

> **byKey**(`key`): [`State`](State.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:46

###### Parameters

##### key

`string`

###### Returns

[`State`](State.md)\<`T`\> \| `undefined`

***

##### deriveCollection()

###### Call Signature

> **deriveCollection**\<`R`\>(`callback`): [`Collection`](Collection.md)\<`R`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:60

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`) => `R`

##### Returns

[`Collection`](Collection.md)\<`R`\>

###### Call Signature

> **deriveCollection**\<`R`\>(`callback`): [`Collection`](Collection.md)\<`R`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:61

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`, `abort`) => `Promise`\<`R`\>

##### Returns

[`Collection`](Collection.md)\<`R`\>

***

##### get()

> **get**(): `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:41

###### Returns

`T`[]

***

##### indexOfKey()

> **indexOfKey**(`key`): `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:48

###### Parameters

##### key

`string`

###### Returns

`number`

***

##### keyAt()

> **keyAt**(`index`): `string` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:47

###### Parameters

##### index

`number`

###### Returns

`string` \| `undefined`

***

##### keys()

> **keys**(): `IterableIterator`\<`string`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:45

###### Returns

`IterableIterator`\<`string`\>

***

##### remove()

> **remove**(`keyOrIndex`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:50

###### Parameters

##### keyOrIndex

`string` \| `number`

###### Returns

`void`

***

##### replace()

> **replace**(`key`, `value`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:57

Updates an existing item by key, propagating to all subscribers.
No-op if the key does not exist or the value is reference-equal to the current value.

###### Parameters

##### key

`string`

Stable key of the item to update

##### value

`T`

New value for the item

###### Returns

`void`

***

##### set()

> **set**(`next`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:42

###### Parameters

##### next

`T`[]

###### Returns

`void`

***

##### sort()

> **sort**(`compareFn?`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:58

###### Parameters

##### compareFn?

(`a`, `b`) => `number`

###### Returns

`void`

***

##### splice()

> **splice**(`start`, `deleteCount?`, ...`items`): `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:59

###### Parameters

##### start

`number`

##### deleteCount?

`number`

##### items

...`T`[]

###### Returns

`T`[]

***

##### update()

> **update**(`fn`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:43

###### Parameters

##### fn

(`prev`) => `T`[]

###### Returns

`void`
