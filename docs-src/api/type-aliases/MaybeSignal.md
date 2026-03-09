### Type Alias: MaybeSignal\<T\>

> **MaybeSignal**\<`T`\> = `T` \| [`Signal`](Signal.md)\<`T`\> \| [`MemoCallback`](MemoCallback.md)\<`T`\> \| [`TaskCallback`](TaskCallback.md)\<`T`\>

Defined in: [src/component.ts:96](https://github.com/zeixcom/le-truc/blob/2572527650262b9f6697a458b486f766495416eb/src/component.ts#L96)

Any value that `#setAccessor` can turn into a signal:
- `T` — wrapped in `createState()`
- `Signal<T>` — used directly
- `MemoCallback<T>` — wrapped in `createComputed()`
- `TaskCallback<T>` — wrapped in `createTask()`

#### Type Parameters

##### T

`T` *extends* `object`
