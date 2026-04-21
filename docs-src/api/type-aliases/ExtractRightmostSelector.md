### Type Alias: ExtractRightmostSelector\<S\>

> **ExtractRightmostSelector**\<`S`\> = `S` *extends* `` `${string} ${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}>${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}+${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}~${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S`

Defined in: [src/ui.ts:20](https://github.com/zeixcom/le-truc/blob/56101c7b29abec1b313b7eb357a8db22a4da0ef6/src/ui.ts#L20)

#### Type Parameters

##### S

`S` *extends* `string`
