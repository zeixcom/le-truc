### Type Alias: MaybeSignal\<T\>

> **MaybeSignal**\<`T`\> = `T` \| [`Signal`](Signal.md)\<`T`\> \| [`MemoCallback`](MemoCallback.md)\<`T`\> \| [`TaskCallback`](TaskCallback.md)\<`T`\>

Defined in: [src/component.ts:92](https://github.com/zeixcom/le-truc/blob/715e9bd5c4e382082b6ddd7a0cf9768da5f33744/src/component.ts#L92)

Any value that `#setAccessor` can turn into a signal:
- `T` — wrapped in `createState()`
- `Signal<T>` — used directly
- `MemoCallback<T>` — wrapped in `createComputed()`
- `TaskCallback<T>` — wrapped in `createTask()`

#### Type Parameters

##### T

`T` *extends* `object`
