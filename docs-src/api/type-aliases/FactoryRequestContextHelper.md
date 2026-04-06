### Type Alias: FactoryRequestContextHelper

> **FactoryRequestContextHelper** = \<`T`\>(`context`, `fallback`) => [`Memo`](Memo.md)\<`T`\>

Defined in: [src/component.ts:230](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/component.ts#L230)

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
