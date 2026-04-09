### Function: schedule()

> **schedule**(`element`, `task`): `void`

Defined in: [src/scheduler.ts:43](https://github.com/zeixcom/le-truc/blob/41c579cf74dea25346deb2e44ba0238619c3dcd3/src/scheduler.ts#L43)

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
