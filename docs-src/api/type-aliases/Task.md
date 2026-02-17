[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Task

# Type Alias: Task\<T\>

> **Task**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/task.d.ts:9

An asynchronous reactive computation (colorless async).
Automatically tracks dependencies and re-executes when they change.
Provides abort semantics and pending state tracking.

## Type Parameters

### T

`T` *extends* `object`

The type of value resolved by the task

## Properties

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"Task"`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/task.d.ts:10

## Methods

### abort()

> **abort**(): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/task.d.ts:28

Aborts the current computation if one is running.
The task's AbortSignal will be triggered.

#### Returns

`void`

***

### get()

> **get**(): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/task.d.ts:18

Gets the current value of the task.
Returns the last resolved value, even while a new computation is pending.
When called inside another reactive context, creates a dependency.

#### Returns

`T`

The current value

#### Throws

UnsetSignalValueError If the task value is still unset when read.

***

### isPending()

> **isPending**(): `boolean`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/task.d.ts:23

Checks if the task is currently executing.

#### Returns

`boolean`

True if a computation is in progress
