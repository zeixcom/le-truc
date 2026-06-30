### Type Alias: MaybeSignal\<T\>

> **MaybeSignal**\<`T`\> = `T` \| [`Signal`](Signal.md)\<`T`\> \| [`MemoCallback`](MemoCallback.md)\<`T`\> \| [`TaskCallback`](TaskCallback.md)\<`T`\>

Defined in: [src/component.ts:53](https://github.com/zeixcom/le-truc/blob/2877d2afe24fa5dcc6cc8851f03777f67a181664/src/component.ts#L53)

Any value that `#setAccessor` can turn into a signal:
- `T` — wrapped in `createState()`
- `Signal<T>` — used directly
- `MemoCallback<T>` — wrapped in `createComputed()`
- `TaskCallback<T>` — wrapped in `createTask()`

#### Type Parameters

##### T

`T` *extends* `object`
