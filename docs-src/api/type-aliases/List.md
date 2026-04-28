### Type Alias: List\<T, S\>

> **List**\<`T`, `S`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:40

A reactive ordered array with stable keys and per-item reactivity.
Each item is a `MutableSignal<T>`; structural changes (add/remove/sort) propagate reactively.

#### Type Parameters

##### T

`T` *extends* `object`

The type of items in the list

##### S

`S` *extends* `MutableSignal`\<`T`\> = `MutableSignal`\<`T`\>

#### Properties

##### \[isConcatSpreadable\]

> `readonly` **\[isConcatSpreadable\]**: `true`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:42

***

##### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"List"`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:41

***

##### length

> `readonly` **length**: `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:44

#### Methods

##### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<`S`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:43

###### Returns

`IterableIterator`\<`S`\>

***

##### add()

> **add**(`value`): `string`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:53

###### Parameters

##### value

`T`

###### Returns

`string`

***

##### at()

> **at**(`index`): `S` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:48

###### Parameters

##### index

`number`

###### Returns

`S` \| `undefined`

***

##### byKey()

> **byKey**(`key`): `S` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:50

###### Parameters

##### key

`string`

###### Returns

`S` \| `undefined`

***

##### deriveCollection()

###### Call Signature

> **deriveCollection**\<`R`\>(`callback`): [`Collection`](Collection.md)\<`R`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:64

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

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:65

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

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:45

###### Returns

`T`[]

***

##### indexOfKey()

> **indexOfKey**(`key`): `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:52

###### Parameters

##### key

`string`

###### Returns

`number`

***

##### keyAt()

> **keyAt**(`index`): `string` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:51

###### Parameters

##### index

`number`

###### Returns

`string` \| `undefined`

***

##### keys()

> **keys**(): `IterableIterator`\<`string`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:49

###### Returns

`IterableIterator`\<`string`\>

***

##### remove()

> **remove**(`keyOrIndex`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:54

###### Parameters

##### keyOrIndex

`string` \| `number`

###### Returns

`void`

***

##### replace()

> **replace**(`key`, `value`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:61

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

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:46

###### Parameters

##### next

`T`[]

###### Returns

`void`

***

##### sort()

> **sort**(`compareFn?`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:62

###### Parameters

##### compareFn?

(`a`, `b`) => `number`

###### Returns

`void`

***

##### splice()

> **splice**(`start`, `deleteCount?`, ...`items`): `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:63

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

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:47

###### Parameters

##### fn

(`prev`) => `T`[]

###### Returns

`void`
