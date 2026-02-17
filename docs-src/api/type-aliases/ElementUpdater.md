[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ElementUpdater

# Type Alias: ElementUpdater\<E, T\>

> **ElementUpdater**\<`E`, `T`\> = `object`

Defined in: [src/effects.ts:43](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/effects.ts#L43)

## Type Parameters

### E

`E` *extends* `Element`

### T

`T`

## Properties

### delete()?

> `optional` **delete**: (`element`) => `void`

Defined in: [src/effects.ts:48](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/effects.ts#L48)

#### Parameters

##### element

`E`

#### Returns

`void`

***

### name?

> `optional` **name**: `string`

Defined in: [src/effects.ts:45](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/effects.ts#L45)

***

### op

> **op**: [`UpdateOperation`](UpdateOperation.md)

Defined in: [src/effects.ts:44](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/effects.ts#L44)

***

### read()

> **read**: (`element`) => `T` \| `null`

Defined in: [src/effects.ts:46](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/effects.ts#L46)

#### Parameters

##### element

`E`

#### Returns

`T` \| `null`

***

### reject()?

> `optional` **reject**: (`error`) => `void`

Defined in: [src/effects.ts:50](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/effects.ts#L50)

#### Parameters

##### error

`unknown`

#### Returns

`void`

***

### resolve()?

> `optional` **resolve**: (`element`) => `void`

Defined in: [src/effects.ts:49](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/effects.ts#L49)

#### Parameters

##### element

`E`

#### Returns

`void`

***

### update()

> **update**: (`element`, `value`) => `void`

Defined in: [src/effects.ts:47](https://github.com/zeixcom/le-truc/blob/f8a5d6d9913ce688663329d0b8778de77e691065/src/effects.ts#L47)

#### Parameters

##### element

`E`

##### value

`T`

#### Returns

`void`
