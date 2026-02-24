### Function: schedule()

> **schedule**(`element`, `task`): `void`

Defined in: [src/scheduler.ts:41](https://github.com/zeixcom/le-truc/blob/53281ff4634318c8e0964232bafee60d7a1ccdb2/src/scheduler.ts#L41)

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
