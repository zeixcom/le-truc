### Type Alias: RequestContextHelper

> **RequestContextHelper** = \<`T`\>(`context`, `fallback`) => [`Memo`](Memo.md)\<`T`\>

Defined in: [src/context.ts:67](https://github.com/zeixcom/le-truc/blob/651798956eac55c47eec3d0590fc814ef1eb2ef9/src/context.ts#L67)

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
