[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / List

# Type Alias: List\<T\>

> **List**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:16

## Name

Le Truc

## Version

0.16.0

## Author

Esther Brunner

## Type Parameters

### T

`T` *extends* `object`

## Properties

### \[isConcatSpreadable\]

> `readonly` **\[isConcatSpreadable\]**: `true`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:18

***

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"List"`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:17

***

### length

> `readonly` **length**: `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:20

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<[`State`](State.md)\<`T`\>\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:19

#### Returns

`IterableIterator`\<[`State`](State.md)\<`T`\>\>

***

### add()

> **add**(`value`): `string`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:29

#### Parameters

##### value

`T`

#### Returns

`string`

***

### at()

> **at**(`index`): [`State`](State.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:24

#### Parameters

##### index

`number`

#### Returns

[`State`](State.md)\<`T`\> \| `undefined`

***

### byKey()

> **byKey**(`key`): [`State`](State.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:26

#### Parameters

##### key

`string`

#### Returns

[`State`](State.md)\<`T`\> \| `undefined`

***

### deriveCollection()

#### Call Signature

> **deriveCollection**\<`R`\>(`callback`): [`Collection`](Collection.md)\<`R`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:33

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`) => `R`

##### Returns

[`Collection`](Collection.md)\<`R`\>

#### Call Signature

> **deriveCollection**\<`R`\>(`callback`): [`Collection`](Collection.md)\<`R`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:34

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`, `abort`) => `Promise`\<`R`\>

##### Returns

[`Collection`](Collection.md)\<`R`\>

***

### get()

> **get**(): `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:21

#### Returns

`T`[]

***

### indexOfKey()

> **indexOfKey**(`key`): `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:28

#### Parameters

##### key

`string`

#### Returns

`number`

***

### keyAt()

> **keyAt**(`index`): `string` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:27

#### Parameters

##### index

`number`

#### Returns

`string` \| `undefined`

***

### keys()

> **keys**(): `IterableIterator`\<`string`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:25

#### Returns

`IterableIterator`\<`string`\>

***

### remove()

> **remove**(`keyOrIndex`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:30

#### Parameters

##### keyOrIndex

`string` | `number`

#### Returns

`void`

***

### set()

> **set**(`next`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:22

#### Parameters

##### next

`T`[]

#### Returns

`void`

***

### sort()

> **sort**(`compareFn?`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:31

#### Parameters

##### compareFn?

(`a`, `b`) => `number`

#### Returns

`void`

***

### splice()

> **splice**(`start`, `deleteCount?`, ...`items`): `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:32

#### Parameters

##### start

`number`

##### deleteCount?

`number`

##### items

...`T`[]

#### Returns

`T`[]

***

### update()

> **update**(`fn`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:23

#### Parameters

##### fn

(`prev`) => `T`[]

#### Returns

`void`
