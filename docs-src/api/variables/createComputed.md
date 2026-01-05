[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / createComputed

# Variable: createComputed()

> `const` **createComputed**: \<`T`\>(`callback`, `initialValue?`) => [`Task`](../classes/Task.md)\<`T`\> \| [`Memo`](../classes/Memo.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:87

Create a derived signal from existing signals

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### callback

Computation callback function

`TaskCallback`\<`T`\> | `MemoCallback`\<`T`\>

### initialValue?

`T`

## Returns

[`Task`](../classes/Task.md)\<`T`\> \| [`Memo`](../classes/Memo.md)\<`T`\>

## Since

0.9.0
