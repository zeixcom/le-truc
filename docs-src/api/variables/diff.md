[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / diff

# Variable: diff()

> `const` **diff**: \<`T`\>(`oldObj`, `newObj`) => [`DiffResult`](../type-aliases/DiffResult.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/diff.d.ts:31

Compares two records and returns a result object containing the differences.

## Type Parameters

### T

`T` *extends* `UnknownRecord` \| `UnknownArray`

## Parameters

### oldObj

`T` *extends* `UnknownArray` ? `ArrayToRecord`\<`T`\> : `T`

The old record to compare

### newObj

`T` *extends* `UnknownArray` ? `ArrayToRecord`\<`T`\> : `T`

The new record to compare

## Returns

[`DiffResult`](../type-aliases/DiffResult.md)\<`T`\>

The result of the comparison

## Since

0.15.0
