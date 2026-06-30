### Type Alias: ExtractTagFromSimpleSelector\<S\>

> **ExtractTagFromSimpleSelector**\<`S`\> = `S` *extends* `` `${infer T}.${string}` `` ? `T` : `S` *extends* `` `${infer T}#${string}` `` ? `T` : `S` *extends* `` `${infer T}[${string}` `` ? `T` *extends* `` `${string}:${string}` `` ? `S` *extends* `` `${infer U}:${string}` `` ? `U` : `S` : `T` : `S` *extends* `` `${infer T}:${string}` `` ? `T` : `S`

Defined in: [src/helpers/dom.ts:39](https://github.com/zeixcom/le-truc/blob/2877d2afe24fa5dcc6cc8851f03777f67a181664/src/helpers/dom.ts#L39)

#### Type Parameters

##### S

`S` *extends* `string`
