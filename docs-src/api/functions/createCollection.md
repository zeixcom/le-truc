[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / createCollection

# Function: createCollection()

> **createCollection**\<`T`\>(`watched`, `options?`): [`Collection`](../type-aliases/Collection.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:52

Creates an externally-driven Collection with a watched lifecycle.
Items are managed via the `applyChanges(changes)` helper passed to the watched callback.
The collection activates when first accessed by an effect and deactivates when no longer watched.

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### watched

`CollectionCallback`\<`T`\>

Callback invoked when the collection starts being watched, receives applyChanges helper

### options?

[`CollectionOptions`](../type-aliases/CollectionOptions.md)\<`T`\>

Optional configuration including initial value, key generation, and item signal creation

## Returns

[`Collection`](../type-aliases/Collection.md)\<`T`\>

A read-only Collection signal

## Since

0.18.0
