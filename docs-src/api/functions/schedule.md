### Function: schedule()

> **schedule**(`element`, `task`): `void`

Defined in: [src/scheduler.ts:43](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/scheduler.ts#L43)

Schedule a task to be executed on the next animation frame, with automatic
deduplication per element. If the same element schedules multiple tasks
before the next frame, only the latest task will be executed.

Used internally by `on()` for passive events and by `dangerouslyBindInnerHTML`.

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
