[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Collection

# Type Alias: Collection\<T\>

> **Collection**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:5

Le Truc

Version 0.16.1

## Author

Esther Brunner, Zeix AG

## Type Parameters

### T

`T` *extends* `object`

## Properties

### \[isConcatSpreadable\]

> `readonly` **\[isConcatSpreadable\]**: `true`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:7

***

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"Collection"`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:6

***

### length

> `readonly` **length**: `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:17

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<[`Signal`](Signal.md)\<`T`\>\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:8

#### Returns

`IterableIterator`\<[`Signal`](Signal.md)\<`T`\>\>

***

### at()

> **at**(`index`): [`Signal`](Signal.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:11

#### Parameters

##### index

`number`

#### Returns

[`Signal`](Signal.md)\<`T`\> \| `undefined`

***

### byKey()

> **byKey**(`key`): [`Signal`](Signal.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:12

#### Parameters

##### key

`string`

#### Returns

[`Signal`](Signal.md)\<`T`\> \| `undefined`

***

### deriveCollection()

#### Call Signature

> **deriveCollection**\<`R`\>(`callback`): `Collection`\<`R`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:15

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`) => `R`

##### Returns

`Collection`\<`R`\>

#### Call Signature

> **deriveCollection**\<`R`\>(`callback`): `Collection`\<`R`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:16

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`, `abort`) => `Promise`\<`R`\>

##### Returns

`Collection`\<`R`\>

***

### get()

> **get**(): `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:10

#### Returns

`T`[]

***

### indexOfKey()

> **indexOfKey**(`key`): `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:14

#### Parameters

##### key

`string`

#### Returns

`number`

***

### keyAt()

> **keyAt**(`index`): `string` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:13

#### Parameters

##### index

`number`

#### Returns

`string` \| `undefined`

***

### keys()

> **keys**(): `IterableIterator`\<`string`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:9

#### Returns

`IterableIterator`\<`string`\>
