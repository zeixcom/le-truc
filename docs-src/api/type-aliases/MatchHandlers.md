[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / MatchHandlers

# Type Alias: MatchHandlers\<T\>

> **MatchHandlers**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:3

Le Truc

Version 0.16.0

## Author

Esther Brunner

## Type Parameters

### T

`T` *extends* readonly [`Signal`](Signal.md)\<`unknown` & `object`\>[]

## Properties

### err()?

> `optional` **err**: (`errors`) => `MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:7

#### Parameters

##### errors

readonly `Error`[]

#### Returns

`MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>

***

### nil()?

> `optional` **nil**: () => `MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:8

#### Returns

`MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>

***

### ok()

> **ok**: (`values`) => `MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:4

#### Parameters

##### values

`{ [K in keyof T]: T[K] extends Signal<infer V> ? V : never }`

#### Returns

`MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>
