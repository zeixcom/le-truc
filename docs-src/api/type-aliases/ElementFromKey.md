### Type Alias: ElementFromKey\<U, K\>

> **ElementFromKey**\<`U`, `K`\> = `NonNullable`\<`U`\[`K`\] *extends* [`Memo`](Memo.md)\<infer E\> ? `E`\[`number`\] : `U`\[`K`\] *extends* `Element` ? `U`\[`K`\] : `never`\>

Defined in: [src/ui.ts:110](https://github.com/zeixcom/le-truc/blob/cbc935087cbb74b599ebc3d8a11ba560b180d4b1/src/ui.ts#L110)

#### Type Parameters

##### U

`U` *extends* [`UI`](UI.md)

##### K

`K` *extends* keyof `U`
