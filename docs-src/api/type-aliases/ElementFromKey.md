### Type Alias: ElementFromKey\<U, K\>

> **ElementFromKey**\<`U`, `K`\> = `NonNullable`\<`U`\[`K`\] *extends* [`Memo`](Memo.md)\<infer E\> ? `E`\[`number`\] : `U`\[`K`\] *extends* `Element` ? `U`\[`K`\] : `never`\>

Defined in: [src/ui.ts:110](https://github.com/zeixcom/le-truc/blob/53281ff4634318c8e0964232bafee60d7a1ccdb2/src/ui.ts#L110)

#### Type Parameters

##### U

`U` *extends* [`UI`](UI.md)

##### K

`K` *extends* keyof `U`
