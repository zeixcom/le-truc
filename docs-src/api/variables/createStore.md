[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / createStore

# Variable: createStore()

> `const` **createStore**: \<`T`\>(`initialValue`) => [`Store`](../type-aliases/Store.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/store.d.ts:56

Create a new store with deeply nested reactive properties

Supports both objects and arrays as initial values. Arrays are converted
to records internally for storage but maintain their array type through
the .get() method, which automatically converts objects with consecutive
numeric keys back to arrays.

## Type Parameters

### T

`T` *extends* `UnknownRecord` \| `UnknownArray`

## Parameters

### initialValue

`T`

initial object or array value of the store

## Returns

[`Store`](../type-aliases/Store.md)\<`T`\>

- new store with reactive properties that preserves the original type T

## Since

0.15.0
