### Type Alias: MaybeSignal\<T\>

> **MaybeSignal**\<`T`\> = `T` \| [`Signal`](Signal.md)\<`T`\> \| [`MemoCallback`](MemoCallback.md)\<`T`\> \| [`TaskCallback`](TaskCallback.md)\<`T`\>

Defined in: [src/component.ts:121](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/component.ts#L121)

Any value that `#setAccessor` can turn into a signal:
- `T` — wrapped in `createState()`
- `Signal<T>` — used directly
- `MemoCallback<T>` — wrapped in `createComputed()`
- `TaskCallback<T>` — wrapped in `createTask()`

#### Type Parameters

##### T

`T` *extends* `object`
