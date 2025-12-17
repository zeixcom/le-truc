[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / schedule

# Function: schedule()

> **schedule**(`element`, `task`): `void`

Defined in: [src/scheduler.ts:41](https://github.com/zeixcom/le-truc/blob/4749c9b4f33eb880ace4f2b7198b83131037c93e/src/scheduler.ts#L41)

Schedule a task to be executed on the next animation frame, with automatic
deduplication per component. If the same component schedules multiple tasks
before the next frame, only the latest task will be executed.

## Parameters

### element

`Element`

Element for deduplication

### task

() => `void`

Function to execute (typically calls batch() or sets a signal)

## Returns

`void`
