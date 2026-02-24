### Type Alias: ElementFromKey\<U, K\>

> **ElementFromKey**\<`U`, `K`\> = `NonNullable`\<`U`\[`K`\] *extends* [`Memo`](Memo.md)\<infer E\> ? `E`\[`number`\] : `U`\[`K`\] *extends* `Element` ? `U`\[`K`\] : `never`\>

Defined in: [src/ui.ts:110](https://github.com/zeixcom/le-truc/blob/216682a13a682782a7a31b91ce98c0ec9f53511a/src/ui.ts#L110)

#### Type Parameters

##### U

`U` *extends* [`UI`](UI.md)

##### K

`K` *extends* keyof `U`
