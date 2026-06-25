### Function: schedule()

> **schedule**(`key`, `task`): `void`

Defined in: [src/scheduler.ts:47](https://github.com/zeixcom/le-truc/blob/db6b1a1848573cd9da112abcb4d5e3ad31b37308/src/scheduler.ts#L47)

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
