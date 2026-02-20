### Type Alias: ElementFromKey\<U, K\>

> **ElementFromKey**\<`U`, `K`\> = `NonNullable`\<`U`\[`K`\] *extends* [`Memo`](Memo.md)\<infer E\> ? `E`\[`number`\] : `U`\[`K`\] *extends* `Element` ? `U`\[`K`\] : `never`\>

Defined in: [src/ui.ts:103](https://github.com/zeixcom/le-truc/blob/b2bd37a6fe13095f4a2fd459382f54953f446e56/src/ui.ts#L103)

#### Type Parameters

##### U

`U` *extends* [`UI`](UI.md)

##### K

`K` *extends* keyof `U`
