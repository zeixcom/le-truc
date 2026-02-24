### Type Alias: ExtractTagFromSimpleSelector\<S\>

> **ExtractTagFromSimpleSelector**\<`S`\> = `S` *extends* `` `${infer T}.${string}` `` ? `T` : `S` *extends* `` `${infer T}#${string}` `` ? `T` : `S` *extends* `` `${infer T}[${string}` `` ? `T` *extends* `` `${string}:${string}` `` ? `S` *extends* `` `${infer U}:${string}` `` ? `U` : `S` : `T` : `S` *extends* `` `${infer T}:${string}` `` ? `T` : `S`

Defined in: [src/ui.ts:35](https://github.com/zeixcom/le-truc/blob/86fb9468cbc91aefb5ba2e30aa8cbb9b82db97bb/src/ui.ts#L35)

#### Type Parameters

##### S

`S` *extends* `string`
