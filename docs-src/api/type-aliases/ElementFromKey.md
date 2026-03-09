### Type Alias: ElementFromKey\<U, K\>

> **ElementFromKey**\<`U`, `K`\> = `NonNullable`\<`U`\[`K`\] *extends* [`Memo`](Memo.md)\<infer E\> ? `E`\[`number`\] : `U`\[`K`\] *extends* `Element` ? `U`\[`K`\] : `never`\>

Defined in: [src/ui.ts:116](https://github.com/zeixcom/le-truc/blob/3c6c7508028647082cdb37ad7cc35a4e25e83a85/src/ui.ts#L116)

Extracts the element type stored at key `K` of a UI object `U`.
- If `U[K]` is a `Memo<E[]>`, resolves to `E`.
- If `U[K]` is a single `Element`, resolves to that element type.

#### Type Parameters

##### U

`U` *extends* [`UI`](UI.md)

##### K

`K` *extends* keyof `U`
