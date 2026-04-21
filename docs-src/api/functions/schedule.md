### Function: schedule()

> **schedule**(`key`, `task`): `void`

Defined in: [src/scheduler.ts:35](https://github.com/zeixcom/le-truc/blob/c5ac50af47ae40f80c1a0a08f969acee81e2622e/src/scheduler.ts#L35)

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
