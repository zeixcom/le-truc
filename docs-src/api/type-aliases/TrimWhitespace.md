### Type Alias: TrimWhitespace\<S\>

> **TrimWhitespace**\<`S`\> = `S` *extends* `` ` ${infer Rest}` `` ? `TrimWhitespace`\<`Rest`\> : `S` *extends* `` `${infer Rest} ` `` ? `TrimWhitespace`\<`Rest`\> : `S`

Defined in: [src/ui.ts:13](https://github.com/zeixcom/le-truc/blob/aeeac355aad9805eb8ee281d5c2dacf08589e2c9/src/ui.ts#L13)

#### Type Parameters

##### S

`S` *extends* `string`
