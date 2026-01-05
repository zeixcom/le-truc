[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Collection

# Type Alias: Collection\<T\>

> **Collection**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:7

## Name

Le Truc

## Version

0.15.1

## Author

Esther Brunner

## Type Parameters

### T

`T` *extends* `object`

## Properties

### \[isConcatSpreadable\]

> `readonly` **\[isConcatSpreadable\]**: `true`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:9

***

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"Collection"`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:8

***

### at()

> **at**: (`index`) => [`Signal`](Signal.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:13

#### Parameters

##### index

`number`

#### Returns

[`Signal`](Signal.md)\<`T`\> \| `undefined`

***

### byKey()

> **byKey**: (`key`) => [`Signal`](Signal.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:14

#### Parameters

##### key

`string`

#### Returns

[`Signal`](Signal.md)\<`T`\> \| `undefined`

***

### deriveCollection()

> **deriveCollection**: \<`R`\>(`callback`) => [`DerivedCollection`](../classes/DerivedCollection.md)\<`R`, `T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:18

#### Type Parameters

##### R

`R` *extends* `object`

#### Parameters

##### callback

`CollectionCallback`\<`R`, `T`\>

#### Returns

[`DerivedCollection`](../classes/DerivedCollection.md)\<`R`, `T`\>

***

### get()

> **get**: () => `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:12

#### Returns

`T`[]

***

### indexOfKey()

> **indexOfKey**: (`key`) => `number` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:16

#### Parameters

##### key

`string`

#### Returns

`number` \| `undefined`

***

### keyAt()

> **keyAt**: (`index`) => `string` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:15

#### Parameters

##### index

`number`

#### Returns

`string` \| `undefined`

***

### length

> `readonly` **length**: `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:19

***

### on()

> **on**: \<`K`\>(`type`, `callback`) => [`Cleanup`](Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:17

#### Type Parameters

##### K

`K` *extends* `Hook`

#### Parameters

##### type

`K`

##### callback

`HookCallback`

#### Returns

[`Cleanup`](Cleanup.md)

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<[`Signal`](Signal.md)\<`T`\>\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:10

#### Returns

`IterableIterator`\<[`Signal`](Signal.md)\<`T`\>\>

***

### keys()

> **keys**(): `IterableIterator`\<`string`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:11

#### Returns

`IterableIterator`\<`string`\>
