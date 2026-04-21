### Type Alias: MaybeSignal\<T\>

> **MaybeSignal**\<`T`\> = `T` \| [`Signal`](Signal.md)\<`T`\> \| [`MemoCallback`](MemoCallback.md)\<`T`\> \| [`TaskCallback`](TaskCallback.md)\<`T`\>

Defined in: [src/component.ts:92](https://github.com/zeixcom/le-truc/blob/56101c7b29abec1b313b7eb357a8db22a4da0ef6/src/component.ts#L92)

Any value that `#setAccessor` can turn into a signal:
- `T` — wrapped in `createState()`
- `Signal<T>` — used directly
- `MemoCallback<T>` — wrapped in `createComputed()`
- `TaskCallback<T>` — wrapped in `createTask()`

#### Type Parameters

##### T

`T` *extends* `object`
