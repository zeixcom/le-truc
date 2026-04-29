### Type Alias: TaskCallback\<T\>

> **TaskCallback**\<`T`\> = (`prev`, `signal`) => `Promise`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:121

A callback function for tasks that asynchronously computes a value.

#### Type Parameters

##### T

`T` *extends* `object`

The type of value computed

#### Parameters

##### prev

`T` \| `undefined`

The previous computed value

##### signal

`AbortSignal`

An AbortSignal that will be triggered if the task is aborted

#### Returns

`Promise`\<`T`\>

A promise that resolves to the new computed value
