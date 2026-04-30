### Type Alias: ExtractTagFromSimpleSelector\<S\>

> **ExtractTagFromSimpleSelector**\<`S`\> = `S` *extends* `` `${infer T}.${string}` `` ? `T` : `S` *extends* `` `${infer T}#${string}` `` ? `T` : `S` *extends* `` `${infer T}[${string}` `` ? `T` *extends* `` `${string}:${string}` `` ? `S` *extends* `` `${infer U}:${string}` `` ? `U` : `S` : `T` : `S` *extends* `` `${infer T}:${string}` `` ? `T` : `S`

Defined in: [src/ui.ts:35](https://github.com/zeixcom/le-truc/blob/bc1e32256363451374968e851cb2302740e32636/src/ui.ts#L35)

#### Type Parameters

##### S

`S` *extends* `string`
