### Function: schedule()

> **schedule**(`element`, `task`): `void`

Defined in: [src/scheduler.ts:44](https://github.com/zeixcom/le-truc/blob/a5013c130127298d8b63211d91f5f6fe8e9cd5f9/src/scheduler.ts#L44)

Schedule a task to be executed on the next animation frame, with automatic
deduplication per element. If the same element schedules multiple tasks
before the next frame, only the latest task will be executed.

Used internally by `on()` for passive events and by `dangerouslySetInnerHTML`.

#### Parameters

##### element

`Element`

Element used as the deduplication key

##### task

() => `void`

Function to execute on the next animation frame

#### Returns

`void`

#### Since

0.11.0
