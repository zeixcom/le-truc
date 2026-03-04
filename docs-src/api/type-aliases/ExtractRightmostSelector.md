### Type Alias: ExtractRightmostSelector\<S\>

> **ExtractRightmostSelector**\<`S`\> = `S` *extends* `` `${string} ${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}>${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}+${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S` *extends* `` `${string}~${infer Rest}` `` ? `ExtractRightmostSelector`\<`Rest`\> : `S`

Defined in: [src/ui.ts:20](https://github.com/zeixcom/le-truc/blob/3b85b2090c0536c825d82eb975bbb1c205d93bce/src/ui.ts#L20)

#### Type Parameters

##### S

`S` *extends* `string`
