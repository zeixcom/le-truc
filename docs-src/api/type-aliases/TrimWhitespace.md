### Type Alias: TrimWhitespace\<S\>

> **TrimWhitespace**\<`S`\> = `S` *extends* `` ` ${infer Rest}` `` ? `TrimWhitespace`\<`Rest`\> : `S` *extends* `` `${infer Rest} ` `` ? `TrimWhitespace`\<`Rest`\> : `S`

Defined in: [src/ui.ts:13](https://github.com/zeixcom/le-truc/blob/651798956eac55c47eec3d0590fc814ef1eb2ef9/src/ui.ts#L13)

#### Type Parameters

##### S

`S` *extends* `string`
