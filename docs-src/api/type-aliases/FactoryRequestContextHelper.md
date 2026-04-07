### Type Alias: FactoryRequestContextHelper

> **FactoryRequestContextHelper** = \<`T`\>(`context`, `fallback`) => [`Memo`](Memo.md)\<`T`\>

Defined in: [src/component.ts:203](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/component.ts#L203)

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
