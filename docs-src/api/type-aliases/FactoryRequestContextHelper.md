### Type Alias: FactoryRequestContextHelper

> **FactoryRequestContextHelper** = \<`T`\>(`context`, `fallback`) => [`Memo`](Memo.md)\<`T`\>

Defined in: [src/context.ts:67](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/context.ts#L67)

The `requestContext` helper type in `FactoryContext`.

Dispatches a `context-request` event from the host and returns a `Memo<T>`
that tracks the provider's value. Falls back to `fallback` if no provider responds.
For use inside `expose()` as a property initializer.

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### context

[`Context`](Context.md)\<`string`, () => `T`\>

##### fallback

`T`

#### Returns

[`Memo`](Memo.md)\<`T`\>
