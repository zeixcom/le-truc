[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Collection

# Type Alias: Collection\<E\>

> **Collection**\<`E`\> = `object`

Defined in: [src/signals/collection.ts:15](https://github.com/zeixcom/le-truc/blob/e99be2f0bb117eaf05d9289fac0c46cf9055e672/src/signals/collection.ts#L15)

## Type Parameters

### E

`E` *extends* `Element`

## Indexable

\[`n`: `number`\]: `E`

## Properties

### \[isConcatSpreadable\]

> `readonly` **\[isConcatSpreadable\]**: `true`

Defined in: [src/signals/collection.ts:17](https://github.com/zeixcom/le-truc/blob/e99be2f0bb117eaf05d9289fac0c46cf9055e672/src/signals/collection.ts#L17)

***

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"Collection"`

Defined in: [src/signals/collection.ts:16](https://github.com/zeixcom/le-truc/blob/e99be2f0bb117eaf05d9289fac0c46cf9055e672/src/signals/collection.ts#L16)

***

### length

> `readonly` **length**: `number`

Defined in: [src/signals/collection.ts:22](https://github.com/zeixcom/le-truc/blob/e99be2f0bb117eaf05d9289fac0c46cf9055e672/src/signals/collection.ts#L22)

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<`E`\>

Defined in: [src/signals/collection.ts:18](https://github.com/zeixcom/le-truc/blob/e99be2f0bb117eaf05d9289fac0c46cf9055e672/src/signals/collection.ts#L18)

#### Returns

`IterableIterator`\<`E`\>

***

### get()

> **get**(): `E`[]

Defined in: [src/signals/collection.ts:20](https://github.com/zeixcom/le-truc/blob/e99be2f0bb117eaf05d9289fac0c46cf9055e672/src/signals/collection.ts#L20)

#### Returns

`E`[]

***

### on()

> **on**(`type`, `listener`): [`Cleanup`](Cleanup.md)

Defined in: [src/signals/collection.ts:21](https://github.com/zeixcom/le-truc/blob/e99be2f0bb117eaf05d9289fac0c46cf9055e672/src/signals/collection.ts#L21)

#### Parameters

##### type

`"add"` | `"remove"`

##### listener

[`CollectionListener`](CollectionListener.md)\<`E`\>

#### Returns

[`Cleanup`](Cleanup.md)
