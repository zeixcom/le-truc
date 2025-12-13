[**le-truc**](../README.md)

***

[le-truc](../globals.md) / Collection

# Interface: Collection\<E\>

Defined in: [src/signals/collection.ts:16](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/signals/collection.ts#L16)

## Type Parameters

### E

`E` *extends* `Element`

## Indexable

\[`n`: `number`\]: `E`

## Properties

### \[isConcatSpreadable\]

> `readonly` **\[isConcatSpreadable\]**: `true`

Defined in: [src/signals/collection.ts:18](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/signals/collection.ts#L18)

***

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"Collection"`

Defined in: [src/signals/collection.ts:17](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/signals/collection.ts#L17)

***

### length

> `readonly` **length**: `number`

Defined in: [src/signals/collection.ts:23](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/signals/collection.ts#L23)

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<`E`\>

Defined in: [src/signals/collection.ts:19](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/signals/collection.ts#L19)

#### Returns

`IterableIterator`\<`E`\>

***

### get()

> **get**(): `E`[]

Defined in: [src/signals/collection.ts:21](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/signals/collection.ts#L21)

#### Returns

`E`[]

***

### on()

> **on**(`type`, `listener`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: [src/signals/collection.ts:22](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/signals/collection.ts#L22)

#### Parameters

##### type

`"add"` | `"remove"`

##### listener

[`CollectionListener`](../type-aliases/CollectionListener.md)\<`E`\>

#### Returns

[`Cleanup`](../type-aliases/Cleanup.md)
