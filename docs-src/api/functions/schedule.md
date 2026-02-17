[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / schedule

# Function: schedule()

> **schedule**(`element`, `task`): `void`

Defined in: [src/scheduler.ts:41](https://github.com/zeixcom/le-truc/blob/755557440db1d4332483c0516277bf183e3ff944/src/scheduler.ts#L41)

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
