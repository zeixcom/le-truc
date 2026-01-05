[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / DerivedCollection

# Class: DerivedCollection\<T, U\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:22

## Name

Le Truc

## Version

0.15.1

## Author

Esther Brunner

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* `object`

## Implements

- [`Collection`](../type-aliases/Collection.md)\<`T`\>

## Constructors

### Constructor

> **new DerivedCollection**\<`T`, `U`\>(`source`, `callback`): `DerivedCollection`\<`T`, `U`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:24

#### Parameters

##### source

`CollectionSource`\<`U`\> | () => `CollectionSource`\<`U`\>

##### callback

`CollectionCallback`\<`T`, `U`\>

#### Returns

`DerivedCollection`\<`T`, `U`\>

## Accessors

### \[isConcatSpreadable\]

#### Get Signature

> **get** **\[isConcatSpreadable\]**(): `true`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:26

##### Returns

`true`

#### Implementation of

`Collection.[isConcatSpreadable]`

***

### \[toStringTag\]

#### Get Signature

> **get** **\[toStringTag\]**(): `"Collection"`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:25

##### Returns

`"Collection"`

#### Implementation of

`Collection.[toStringTag]`

***

### length

#### Get Signature

> **get** **length**(): `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:37

##### Returns

`number`

#### Implementation of

`Collection.length`

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<[`Computed`](../type-aliases/Computed.md)\<`T`\>\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:27

#### Returns

`IterableIterator`\<[`Computed`](../type-aliases/Computed.md)\<`T`\>\>

#### Implementation of

[`Collection`](../type-aliases/Collection.md).[`[iterator]`](../type-aliases/Collection.md#iterator)

***

### at()

> **at**(`index`): [`Computed`](../type-aliases/Computed.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:30

#### Parameters

##### index

`number`

#### Returns

[`Computed`](../type-aliases/Computed.md)\<`T`\> \| `undefined`

#### Implementation of

[`Collection`](../type-aliases/Collection.md).[`at`](../type-aliases/Collection.md#at)

***

### byKey()

> **byKey**(`key`): [`Computed`](../type-aliases/Computed.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:31

#### Parameters

##### key

`string`

#### Returns

[`Computed`](../type-aliases/Computed.md)\<`T`\> \| `undefined`

#### Implementation of

[`Collection`](../type-aliases/Collection.md).[`byKey`](../type-aliases/Collection.md#bykey)

***

### deriveCollection()

#### Call Signature

> **deriveCollection**\<`R`\>(`callback`): `DerivedCollection`\<`R`, `T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:35

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`) => `R`

##### Returns

`DerivedCollection`\<`R`, `T`\>

##### Implementation of

[`Collection`](../type-aliases/Collection.md).[`deriveCollection`](../type-aliases/Collection.md#derivecollection)

#### Call Signature

> **deriveCollection**\<`R`\>(`callback`): `DerivedCollection`\<`R`, `T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:36

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`, `abort`) => `Promise`\<`R`\>

##### Returns

`DerivedCollection`\<`R`, `T`\>

##### Implementation of

[`Collection`](../type-aliases/Collection.md).[`deriveCollection`](../type-aliases/Collection.md#derivecollection)

***

### get()

> **get**(): `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:29

#### Returns

`T`[]

#### Implementation of

[`Collection`](../type-aliases/Collection.md).[`get`](../type-aliases/Collection.md#get)

***

### indexOfKey()

> **indexOfKey**(`key`): `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:33

#### Parameters

##### key

`string`

#### Returns

`number`

#### Implementation of

[`Collection`](../type-aliases/Collection.md).[`indexOfKey`](../type-aliases/Collection.md#indexofkey)

***

### keyAt()

> **keyAt**(`index`): `string` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:32

#### Parameters

##### index

`number`

#### Returns

`string` \| `undefined`

#### Implementation of

[`Collection`](../type-aliases/Collection.md).[`keyAt`](../type-aliases/Collection.md#keyat)

***

### keys()

> **keys**(): `IterableIterator`\<`string`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:28

#### Returns

`IterableIterator`\<`string`\>

#### Implementation of

[`Collection`](../type-aliases/Collection.md).[`keys`](../type-aliases/Collection.md#keys)

***

### on()

> **on**(`type`, `callback`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/collection.d.ts:34

#### Parameters

##### type

`Hook`

##### callback

`HookCallback`

#### Returns

[`Cleanup`](../type-aliases/Cleanup.md)

#### Implementation of

[`Collection`](../type-aliases/Collection.md).[`on`](../type-aliases/Collection.md#on)
