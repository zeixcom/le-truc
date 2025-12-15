[**le-truc**](../README.md)

***

[le-truc](../globals.md) / schedule

# Function: schedule()

> **schedule**(`element`, `task`): `void`

Defined in: [src/scheduler.ts:41](https://github.com/zeixcom/le-truc/blob/e43af8d7276b550a9ea298d116a409ca894b7fd9/src/scheduler.ts#L41)

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
