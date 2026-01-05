[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / List

# Class: List\<T\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:10

## Name

Le Truc

## Version

0.15.1

## Author

Esther Brunner

## Type Parameters

### T

`T` *extends* `object`

## Constructors

### Constructor

> **new List**\<`T`\>(`initialValue`, `keyConfig?`): `List`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:12

#### Parameters

##### initialValue

`T`[]

##### keyConfig?

[`KeyConfig`](../type-aliases/KeyConfig.md)\<`T`\>

#### Returns

`List`\<`T`\>

## Accessors

### \[isConcatSpreadable\]

#### Get Signature

> **get** **\[isConcatSpreadable\]**(): `true`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:14

##### Returns

`true`

***

### \[toStringTag\]

#### Get Signature

> **get** **\[toStringTag\]**(): `"List"`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:13

##### Returns

`"List"`

***

### length

#### Get Signature

> **get** **length**(): `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:16

##### Returns

`number`

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<[`State`](State.md)\<`T`\>\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:15

#### Returns

`IterableIterator`\<[`State`](State.md)\<`T`\>\>

***

### add()

> **add**(`value`): `string`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:25

#### Parameters

##### value

`T`

#### Returns

`string`

***

### at()

> **at**(`index`): [`State`](State.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:20

#### Parameters

##### index

`number`

#### Returns

[`State`](State.md)\<`T`\> \| `undefined`

***

### byKey()

> **byKey**(`key`): [`State`](State.md)\<`T`\> \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:22

#### Parameters

##### key

`string`

#### Returns

[`State`](State.md)\<`T`\> \| `undefined`

***

### deriveCollection()

#### Call Signature

> **deriveCollection**\<`R`\>(`callback`): [`DerivedCollection`](DerivedCollection.md)\<`R`, `T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:30

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`) => `R`

##### Returns

[`DerivedCollection`](DerivedCollection.md)\<`R`, `T`\>

#### Call Signature

> **deriveCollection**\<`R`\>(`callback`): [`DerivedCollection`](DerivedCollection.md)\<`R`, `T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:31

##### Type Parameters

###### R

`R` *extends* `object`

##### Parameters

###### callback

(`sourceValue`, `abort`) => `Promise`\<`R`\>

##### Returns

[`DerivedCollection`](DerivedCollection.md)\<`R`, `T`\>

***

### get()

> **get**(): `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:17

#### Returns

`T`[]

***

### indexOfKey()

> **indexOfKey**(`key`): `number`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:24

#### Parameters

##### key

`string`

#### Returns

`number`

***

### keyAt()

> **keyAt**(`index`): `string` \| `undefined`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:23

#### Parameters

##### index

`number`

#### Returns

`string` \| `undefined`

***

### keys()

> **keys**(): `IterableIterator`\<`string`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:21

#### Returns

`IterableIterator`\<`string`\>

***

### on()

> **on**(`type`, `callback`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:29

#### Parameters

##### type

`Hook`

##### callback

`HookCallback`

#### Returns

[`Cleanup`](../type-aliases/Cleanup.md)

***

### remove()

> **remove**(`keyOrIndex`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:26

#### Parameters

##### keyOrIndex

`string` | `number`

#### Returns

`void`

***

### set()

> **set**(`newValue`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:18

#### Parameters

##### newValue

`T`[]

#### Returns

`void`

***

### sort()

> **sort**(`compareFn?`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:27

#### Parameters

##### compareFn?

(`a`, `b`) => `number`

#### Returns

`void`

***

### splice()

> **splice**(`start`, `deleteCount?`, ...`items?`): `T`[]

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:28

#### Parameters

##### start

`number`

##### deleteCount?

`number`

##### items?

...`T`[]

#### Returns

`T`[]

***

### update()

> **update**(`fn`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/list.d.ts:19

#### Parameters

##### fn

(`oldValue`) => `T`[]

#### Returns

`void`
