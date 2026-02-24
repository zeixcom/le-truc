### Type Alias: TrimWhitespace\<S\>

> **TrimWhitespace**\<`S`\> = `S` *extends* `` ` ${infer Rest}` `` ? `TrimWhitespace`\<`Rest`\> : `S` *extends* `` `${infer Rest} ` `` ? `TrimWhitespace`\<`Rest`\> : `S`

Defined in: [src/ui.ts:13](https://github.com/zeixcom/le-truc/blob/cbc935087cbb74b599ebc3d8a11ba560b180d4b1/src/ui.ts#L13)

#### Type Parameters

##### S

`S` *extends* `string`
