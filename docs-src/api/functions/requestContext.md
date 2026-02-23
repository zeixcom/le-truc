### Function: requestContext()

> **requestContext**\<`T`, `P`, `U`\>(`context`, `fallback`): [`Reader`](../type-aliases/Reader.md)\<[`Memo`](../type-aliases/Memo.md)\<`T`\>, `U` & `object`\>

Defined in: [src/context.ts:141](https://github.com/zeixcom/le-truc/blob/45798dee9dae4e450a431014c6b066824d261d20/src/context.ts#L141)

Request a context value from an ancestor provider, returning a reactive `Memo<T>`.

Use as a property initializer in `defineComponent`. During `connectedCallback`, dispatches
a `context-request` event that bubbles up the DOM. If an ancestor provider intercepts it,
the returned Memo reflects the provider's current value reactively. If no provider responds,
the Memo falls back to `fallback`.

#### Type Parameters

##### T

`T` *extends* `object`

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

#### Parameters

##### context

[`Context`](../type-aliases/Context.md)\<`string`, () => `T`\>

Context key to request

##### fallback

[`Fallback`](../type-aliases/Fallback.md)\<`T`, `U` & `object`\>

Static value or reader function used when no provider is found

#### Returns

[`Reader`](../type-aliases/Reader.md)\<[`Memo`](../type-aliases/Memo.md)\<`T`\>, `U` & `object`\>

Reader that dispatches the request and wraps the result in a Memo

#### Since

0.15.0
