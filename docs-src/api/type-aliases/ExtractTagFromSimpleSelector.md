### Type Alias: ExtractTagFromSimpleSelector\<S\>

> **ExtractTagFromSimpleSelector**\<`S`\> = `S` *extends* `` `${infer T}.${string}` `` ? `T` : `S` *extends* `` `${infer T}#${string}` `` ? `T` : `S` *extends* `` `${infer T}[${string}` `` ? `T` *extends* `` `${string}:${string}` `` ? `S` *extends* `` `${infer U}:${string}` `` ? `U` : `S` : `T` : `S` *extends* `` `${infer T}:${string}` `` ? `T` : `S`

Defined in: [src/ui.ts:35](https://github.com/zeixcom/le-truc/blob/ecfd71ac3d27d86bcfc647fabb6e10e7d9f11413/src/ui.ts#L35)

#### Type Parameters

##### S

`S` *extends* `string`
