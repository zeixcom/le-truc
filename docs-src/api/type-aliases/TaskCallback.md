[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / TaskCallback

# Type Alias: TaskCallback()\<T\>

> **TaskCallback**\<`T`\> = (`prev`, `signal`) => `Promise`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:106

A callback function for tasks that asynchronously computes a value.

## Type Parameters

### T

`T` *extends* `object`

The type of value computed

## Parameters

### prev

The previous computed value

`T` | `undefined`

### signal

`AbortSignal`

An AbortSignal that will be triggered if the task is aborted

## Returns

`Promise`\<`T`\>

A promise that resolves to the new computed value
