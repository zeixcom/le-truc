### Function: schedule()

> **schedule**(`element`, `task`): `void`

Defined in: [src/scheduler.ts:41](https://github.com/zeixcom/le-truc/blob/a15d81f5442bf8607f9db7d5c4ecfccdb568a946/src/scheduler.ts#L41)

Schedule a task to be executed on the next animation frame, with automatic
deduplication per component. If the same component schedules multiple tasks
before the next frame, only the latest task will be executed.

#### Parameters

##### element

`Element`

Element for deduplication

##### task

() => `void`

Function to execute (typically calls batch() or sets a signal)

#### Returns

`void`
