### Type Alias: ExtractTagFromSimpleSelector\<S\>

> **ExtractTagFromSimpleSelector**\<`S`\> = `S` *extends* `` `${infer T}.${string}` `` ? `T` : `S` *extends* `` `${infer T}#${string}` `` ? `T` : `S` *extends* `` `${infer T}:${string}` `` ? `T` : `S` *extends* `` `${infer T}[${string}` `` ? `T` : `S`

Defined in: [src/ui.ts:32](https://github.com/zeixcom/le-truc/blob/569c3554a3bd73c7996dc67fec548045ec940d32/src/ui.ts#L32)

#### Type Parameters

##### S

`S` *extends* `string`
