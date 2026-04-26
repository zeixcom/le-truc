### Function: schedule()

> **schedule**(`key`, `task`): `void`

Defined in: [src/scheduler.ts:35](https://github.com/zeixcom/le-truc/blob/9f8170c07a1296b5e43a3511bac7e4da12ade6c7/src/scheduler.ts#L35)

Schedule a task to be executed on the next animation frame, with automatic
deduplication per element. If the same element schedules multiple tasks
before the next frame, only the latest task executes.

Used internally by `dangerouslyBindInnerHTML`.

#### Parameters

##### key

`object`

Deduplication key; typically the target Element

##### task

() => `void`

Function to execute on the next animation frame

#### Returns

`void`

#### Since

0.11.0
