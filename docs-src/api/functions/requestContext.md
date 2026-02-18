### Function: requestContext()

> **requestContext**\<`T`, `P`, `U`\>(`context`, `fallback`): [`Reader`](../type-aliases/Reader.md)\<[`Memo`](../type-aliases/Memo.md)\<`T`\>, `U` & `object`\>

Defined in: [src/context.ts:133](https://github.com/zeixcom/le-truc/blob/e24d2793804f24d536ad713492cc94d3689bbbde/src/context.ts#L133)

Consume a context value for a component

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

Context key to consume

##### fallback

[`Fallback`](../type-aliases/Fallback.md)\<`T`, `U` & `object`\>

Fallback value or reader function for fallback

#### Returns

[`Reader`](../type-aliases/Reader.md)\<[`Memo`](../type-aliases/Memo.md)\<`T`\>, `U` & `object`\>

Computed signal that returns the consumed context the fallback value

#### Since

0.15.0
